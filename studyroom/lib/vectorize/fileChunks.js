import path from 'path';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { Storage } from '@google-cloud/storage';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_BATCH = 100; // keep batches small to avoid hitting rate limits
const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 200;
const FILE_TYPES = {
  PDF: 'pdf',
  WORD: 'word',
  HANGUL: 'hangul',
  TEXT: 'text',
  IMAGE: 'image',
  OTHER: 'other',
};
function resolveServiceAccountPath(rawPath = '') {
  if (!rawPath) {
    return undefined;
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  const cwd = process.cwd();
  const cwdName = path.basename(cwd);
  const normalized = rawPath.startsWith(`${cwdName}/`)
    ? rawPath.slice(cwdName.length + 1)
    : rawPath;

  return path.join(cwd, normalized);
}

const serviceAccountPath = resolveServiceAccountPath(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const storageClient = serviceAccountPath ? new Storage({ keyFilename: serviceAccountPath }) : new Storage();
const visionFileClient = new ImageAnnotatorClient();

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function normalizeText(input) {
  if (!input) {
    return '';
  }
  const text = Buffer.isBuffer(input) ? input.toString('utf-8') : String(input);
  return text.replace(/\r\n/g, '\n').trim();
}

function detectFileType(fileName = '', contentType = '') {
  const loweredMime = (contentType || '').toLowerCase();
  const ext = (fileName && path.extname(fileName).toLowerCase()) || '';

  if (ext === '.pdf' || loweredMime.includes('pdf')) {
    return FILE_TYPES.PDF;
  }

  if (ext === '.doc' || ext === '.docx' || loweredMime.includes('word')) {
    return FILE_TYPES.WORD;
  }

  if (ext === '.hwp' || ext === '.hwpx' || loweredMime.includes('hwp')) {
    return FILE_TYPES.HANGUL;
  }

  if (
    loweredMime.startsWith('image/') ||
    ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff'].includes(ext)
  ) {
    return FILE_TYPES.IMAGE;
  }

  if (
    loweredMime.startsWith('text/') ||
    ['.txt', '.md', '.csv', '.json'].includes(ext)
  ) {
    return FILE_TYPES.TEXT;
  }

  return FILE_TYPES.OTHER;
}

async function extractTextWithVision(buffer, mimeType) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_API_KEY is not configured; skipping OCR fallback.');
    return '';
  }

  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  const payload = {
    requests: [
      {
        image: { content: buffer.toString('base64') },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      },
    ],
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error('Google Vision API error:', await response.text());
    return '';
  }

  const result = await response.json();
  const text = result?.responses?.[0]?.fullTextAnnotation?.text || '';
  return normalizeText(text);
}

async function extractPdfTextWithVisionAsync(buffer, mimeType = 'application/pdf') {
  const bucketName = process.env.GOOGLE_OCR_GCS_BUCKET;
  if (!bucketName) {
    throw new Error('GOOGLE_OCR_GCS_BUCKET is not configured');
  }

  const bucket = storageClient.bucket(bucketName);
  const uniqueId = randomUUID();
  const inputPath = `ocr-input/${uniqueId}.pdf`;
  const outputPrefix = `ocr-output/${uniqueId}/`;

  try {
    await bucket.file(outputPrefix).save('', { resumable: false });
    await bucket.file(inputPath).save(buffer, {
      resumable: false,
      contentType: mimeType,
      metadata: { cacheControl: 'no-cache' },
    });

    const request = {
      requests: [
        {
          inputConfig: {
            gcsSource: { uri: `gs://${bucketName}/${inputPath}` },
            mimeType,
          },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          outputConfig: {
            gcsDestination: { uri: `gs://${bucketName}/${outputPrefix}` },
            batchSize: 10,
          },
        },
      ],
    };

    const [operation] = await visionFileClient.asyncBatchAnnotateFiles(request);
    await operation.promise();

    const [outputFiles] = await bucket.getFiles({ prefix: outputPrefix });

    // 로그 추가: OCR 출력 파일 확인
    console.log(`[OCR Debug] 총 ${outputFiles?.length || 0}개 파일 발견:`,
      outputFiles?.map(f => f.name) || []);

    if (!outputFiles || outputFiles.length === 0) {
      console.warn('Vision async batch returned no OCR output files');
      return '';
    }

    const collectedText = [];
    for (const file of outputFiles) {
      // 실제 JSON 파일만 처리 (빈 디렉토리 파일 제외)
      if (file.name.endsWith('.json')) {
        console.log(`[OCR Debug] 처리 중: ${file.name}`);
        try {
          const [contents] = await file.download();
          const parsed = JSON.parse(contents.toString('utf-8'));
          parsed?.responses?.forEach((response) => {
            const annotation = response?.fullTextAnnotation?.text;
            if (annotation) {
              collectedText.push(annotation);
            }
          });
        } catch (error) {
          console.error(`Failed to parse Vision OCR output from ${file.name}:`, error);
        }
      }
    }

    return normalizeText(collectedText.join('\n'));
  } catch (error) {
    console.error('Vision async batch OCR failed:', error);
    return '';
  } finally {
    try {
      await bucket.file(inputPath).delete({ ignoreNotFound: true });
    } catch (error) {
      console.warn('Failed to delete OCR input file:', error);
    }

    try {
      const [outputFiles] = await bucket.getFiles({ prefix: outputPrefix });
      await Promise.all(
        (outputFiles || []).map((file) =>
          file.delete().catch((err) => {
            console.warn('Failed to delete OCR output file:', err);
          }),
        ),
      );
    } catch (error) {
      console.warn('Failed to clean up OCR output files:', error);
    }
  }
}

async function extractTextFromFile(buffer, fileType, mimeType = '') {
  if (fileType === FILE_TYPES.PDF) {
    const ocrText = await extractPdfTextWithVisionAsync(buffer, mimeType || 'application/pdf');
    if (ocrText) {
      return ocrText;
    }

    throw new Error('PDF 파일에서 텍스트를 추출할 수 없습니다');
  }

  if (fileType === FILE_TYPES.IMAGE) {
    const ocrText = await extractTextWithVision(buffer, mimeType || 'image/png');
    if (ocrText) {
      return ocrText;
    }
    return '';
  }

  if (fileType === FILE_TYPES.OTHER && (mimeType || '').toLowerCase().startsWith('image/')) {
    const ocrText = await extractTextWithVision(buffer, mimeType);
    if (ocrText) {
      return ocrText;
    }
  }

  return normalizeText(buffer);
}

function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
  const chunks = [];
  if (!text) {
    return chunks;
  }

  let cursor = 0;
  while (cursor < text.length) {
    const end = Math.min(text.length, cursor + chunkSize);
    const chunk = text.slice(cursor, end).trim();
    if (chunk) {
      chunks.push({
        content: chunk,
        start: cursor,
        end,
      });
    }
    if (end === text.length) {
      break;
    }
    cursor += Math.max(1, chunkSize - overlap);
  }

  return chunks;
}

async function embedChunks(openai, contents) {
  const embeddings = [];
  for (let i = 0; i < contents.length; i += MAX_BATCH) {
    const batch = contents.slice(i, i + MAX_BATCH);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    response.data.forEach((item) => {
      embeddings.push(item.embedding);
    });
  }
  return embeddings;
}

export async function vectorizeFileChunks({
  fileId,
  roomId,
  fileName,
  filePath,
  fileBuffer,
  fileMime,
}) {
  if (!fileId || !roomId || !filePath) {
    throw new Error('vectorizeFileChunks: missing required identifiers');
  }

  const supabaseService = getSupabaseServiceClient();
  if (!supabaseService) {
    throw new Error('Supabase service client is not configured');
  }

  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  let buffer = fileBuffer;
  if (!buffer) {
    const { data, error } = await supabaseService.storage
      .from(process.env.SUPABASE_ROOM_FILES_BUCKET || 'room-files')
      .download(filePath);

    if (error || !data) {
      throw new Error('파일 다운로드에 실패했습니다');
    }

    const arrayBuffer = await data.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  }

  const fileType = detectFileType(fileName, fileMime);
  const normalized = await extractTextFromFile(buffer, fileType, fileMime);
  if (!normalized) {
    return { chunkCount: 0 };
  }

  const chunks = chunkText(normalized);
  if (chunks.length === 0) {
    return { chunkCount: 0 };
  }

  const embeddings = await embedChunks(openai, chunks.map((chunk) => chunk.content));

  if (embeddings.length !== chunks.length) {
    throw new Error('임베딩 처리 결과가 조각 수와 일치하지 않습니다');
  }

  await supabaseService.from('FileChunk').delete().eq('FileID', fileId);

  const payload = chunks.map((chunk, index) => ({
    FileID: fileId,
    ChunkText: chunk.content,
    ChunkIndex: index,
    ChunkMetadata: {
      roomId,
      fileName,
      filePath,
      charStart: chunk.start,
      charEnd: chunk.end,
    },
    Embedding: embeddings[index],
  }));

  const { error: insertError } = await supabaseService.from('FileChunk').insert(payload);
  if (insertError) {
    throw insertError;
  }

  return { chunkCount: payload.length };
}
