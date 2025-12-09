import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 텍스트를 임베딩 벡터로 변환
 * @param {string} text - 임베딩할 텍스트
 * @returns {Promise<number[]|null>} 1536차원 임베딩 벡터 또는 null
 */
export async function generateEmbedding(text) {
  try {
    if (!text || text.trim().length === 0) {
      console.warn('[generateEmbedding] 빈 텍스트');
      return null;
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.trim(),
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('[generateEmbedding] 임베딩 생성 실패:', error);
    return null;
  }
}

/**
 * pgvector를 사용한 의미론적 유사도 검색
 * @param {number[]} queryEmbedding - 검색 쿼리의 임베딩 벡터
 * @param {string[]} fileIds - 검색 대상 파일 ID 배열
 * @param {Object} options - 검색 옵션
 * @param {number} options.threshold - 최소 유사도 (0~1, 기본값 0.7)
 * @param {number} options.limit - 반환 청크 수 (기본값 20)
 * @returns {Promise<Array|null>} 유사한 청크 배열 또는 null
 */
export async function searchSimilarChunks(
  queryEmbedding,
  fileIds,
  options = {}
) {
  try {
    const { threshold = 0.7, limit = 20 } = options;

    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
      console.warn('[searchSimilarChunks] 유효하지 않은 임베딩');
      return null;
    }

    if (!fileIds || fileIds.length === 0) {
      console.warn('[searchSimilarChunks] 파일 ID 없음');
      return null;
    }

    const supabase = await createClient();

    // Supabase RPC 호출: match_chunks 함수 실행
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      file_ids: fileIds,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error('[searchSimilarChunks] pgvector 검색 실패:', error);
      return null;
    }

    console.log(
      `[searchSimilarChunks] ${data?.length || 0}개 청크 발견 (threshold: ${threshold})`
    );
    return data || [];
  } catch (error) {
    console.error('[searchSimilarChunks] 검색 오류:', error);
    return null;
  }
}

/**
 * 광범위한 주제 vs 구체적 주제 감지
 * @param {string} quizTitle - 퀴즈 제목 또는 주제
 * @returns {boolean} true: 광범위한 주제, false: 구체적 주제
 */
export function detectBroadTopic(quizTitle) {
  if (!quizTitle || quizTitle.trim().length === 0) {
    return true; // 제목 없으면 광범위로 간주
  }

  const title = quizTitle.trim();

  // 광범위한 키워드 목록
  const broadKeywords = [
    '전체',
    '모든',
    '종합',
    '대비',
    '기말',
    '중간',
    '복습',
    '정리',
    '총정리',
    '전반',
    '전범위',
    '모음',
    '시험',
    '고사',
  ];

  // 키워드 포함 여부 체크
  const hasBroadKeyword = broadKeywords.some((keyword) =>
    title.includes(keyword)
  );

  // 6글자 이하는 광범위로 간주 (짧은 키워드는 의미론적 검색 어려움)
  const isTooShort = title.length <= 6;

  const isBroad = hasBroadKeyword || isTooShort;

  console.log(
    `[detectBroadTopic] "${title}" → ${isBroad ? '광범위' : '구체적'}`
  );
  return isBroad;
}

/**
 * 모든 청크 가져오기 (광범위한 주제 또는 폴백용)
 * @param {string[]} fileIds - 파일 ID 배열
 * @param {number} maxChars - 최대 문자 수 (기본값 8000)
 * @returns {Promise<string|null>} 연결된 청크 텍스트 또는 null
 */
export async function getAllChunks(fileIds, maxChars = 8000) {
  try {
    if (!fileIds || fileIds.length === 0) {
      console.warn('[getAllChunks] 파일 ID 없음');
      return null;
    }

    const supabase = await createClient();

    // FileChunk 테이블에서 전체 청크 조회
    const { data: chunks, error } = await supabase
      .from('FileChunk')
      .select('ChunkText, ChunkIndex')
      .in('FileID', fileIds)
      .order('FileID', { ascending: true })
      .order('ChunkIndex', { ascending: true });

    if (error) {
      console.error('[getAllChunks] 청크 조회 실패:', error);
      return null;
    }

    if (!chunks || chunks.length === 0) {
      console.warn('[getAllChunks] 청크 없음');
      return null;
    }

    console.log(`[getAllChunks] ${chunks.length}개 청크 발견`);

    // 청크를 최대 문자 수까지 연결
    let combinedText = '';
    for (const chunk of chunks) {
      const nextText = combinedText + chunk.ChunkText + '\n\n---\n\n';
      if (nextText.length > maxChars) {
        break; // 최대 문자 수 초과 시 중단
      }
      combinedText = nextText;
    }

    console.log(`[getAllChunks] ${combinedText.length}자 반환`);
    return combinedText.trim();
  } catch (error) {
    console.error('[getAllChunks] 오류:', error);
    return null;
  }
}

/**
 * 의미론적 검색 결과를 텍스트로 변환 (단계적 threshold 조정)
 * @param {string} quizTitle - 퀴즈 제목 또는 주제
 * @param {string[]} fileIds - 파일 ID 배열
 * @param {number} maxChars - 최대 문자 수 (기본값 8000)
 * @returns {Promise<string|null>} 검색된 청크 텍스트 또는 null
 */
export async function getRelevantChunks(quizTitle, fileIds, maxChars = 8000) {
  try {
    // 1. 광범위한 주제 감지
    const isBroadTopic = detectBroadTopic(quizTitle);
    if (isBroadTopic) {
      console.log('[getRelevantChunks] 광범위한 주제 → 전체 청크 사용');
      return await getAllChunks(fileIds, maxChars);
    }

    // 2. 구체적 주제 → 임베딩 생성
    const queryEmbedding = await generateEmbedding(quizTitle);
    if (!queryEmbedding) {
      console.warn(
        '[getRelevantChunks] 임베딩 생성 실패 → 전체 청크로 폴백'
      );
      return await getAllChunks(fileIds, maxChars);
    }

    // 3. 단계적 threshold 조정 (0.7 → 0.6 → 0.5 → 0.4 → 0.35 → 0.3)
    const thresholds = [0.7, 0.6, 0.5, 0.4, 0.35, 0.3];
    for (const threshold of thresholds) {
      const chunks = await searchSimilarChunks(queryEmbedding, fileIds, {
        threshold,
        limit: 30, // 충분히 많이 가져옴
      });

      if (chunks && chunks.length > 0) {
        console.log(
          `[getRelevantChunks] threshold ${threshold}에서 ${chunks.length}개 발견`
        );

        // 청크를 유사도 순으로 연결 (이미 정렬됨)
        let combinedText = '';
        for (const chunk of chunks) {
          const nextText =
            combinedText + chunk.ChunkText + '\n\n---\n\n';
          if (nextText.length > maxChars) {
            break;
          }
          combinedText = nextText;
        }

        if (combinedText.length > 0) {
          console.log(`[getRelevantChunks] ${combinedText.length}자 반환`);
          return combinedText.trim();
        }
      }
    }

    // 4. 최종 폴백: 모든 청크 사용
    console.warn('[getRelevantChunks] 유사 청크 없음 → 전체 청크로 폴백');
    return await getAllChunks(fileIds, maxChars);
  } catch (error) {
    console.error('[getRelevantChunks] 오류:', error);
    return null;
  }
}
