import OpenAI from 'openai';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_BATCH = 100; // keep batches small to avoid hitting rate limits
const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 200;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function normalizeText(buffer) {
  const text = buffer.toString('utf-8');
  return text.replace(/\r\n/g, '\n').trim();
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

  const normalized = normalizeText(buffer);
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
