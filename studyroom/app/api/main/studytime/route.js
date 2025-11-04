// app/api/main/studytime/route.js
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// 공부시간 조회 (GET)
export async function GET(request) {
  try {
    // 1. 사용자 인증 확인
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 2. Supabase 클라이언트 생성
    const supabase = createClient();

    // 3. 오늘 날짜 범위 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 4. 오늘의 공부시간 기록 조회
    const { data: studyTimes, error } = await supabase
      .from('StudyTime')
      .select('*')
      .eq('학습자아이디', user.id)
      .gte('저장시각아이디', today.toISOString())
      .lt('저장시각아이디', tomorrow.toISOString())
      .order('저장시각아이디', { ascending: true });

    if (error) {
      console.error('StudyTime query error:', error);
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // 5. 총 공부시간 계산 (분 단위)
    const totalStudyTime = studyTimes.reduce((total, record) => {
      return total + (record.시간 || 0);
    }, 0);

    // 6. 현재 활성화된 타이머 확인
    const activeTimer = studyTimes.find(record => record.SaveTimeID === null);

    return Response.json({
      totalStudyTime, // 오늘 총 공부시간 (분)
      activeTimer: activeTimer || null, // 현재 실행 중인 타이머
      records: studyTimes, // 전체 기록
    }, { status: 200 });

  } catch (err) {
    console.error('GET /api/main/studytime error:', err);
    return Response.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 공부시간 일시정지/시작 (POST)
export async function POST(request) {
  try {
    // 1. 사용자 인증 확인
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 2. 요청 body 파싱
    const { action, studyTime } = await request.json();
    // action: 'start' | 'pause' | 'reset'
    // studyTime: 타이머 시작 시각 (ISO string) - pause/reset 시 사용

    // 3. Supabase 클라이언트 생성
    const supabase = createClient();

    if (action === 'start') {
      // 타이머 시작 - 새로운 기록 생성
      const { data, error } = await supabase
        .from('StudyTime')
        .insert([{
          학습자아이디: user.id,
          시간: 0,
          SaveTimeID: null, // 아직 저장되지 않음 (진행 중)
        }])
        .select()
        .single();

      if (error) {
        console.error('Start timer error:', error);
        return Response.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return Response.json({
        message: '타이머가 시작되었습니다',
        timer: data,
      }, { status: 201 });

    } else if (action === 'pause') {
      // 타이머 일시정지 - studyTime 업데이트
      if (!studyTime) {
        return Response.json(
          { error: '공부시간 정보가 필요합니다' },
          { status: 400 }
        );
      }

      // 현재 활성 타이머 찾기
      const { data: activeTimers, error: findError } = await supabase
        .from('StudyTime')
        .select('*')
        .eq('학습자아이디', user.id)
        .is('SaveTimeID', null)
        .order('저장시각아이디', { ascending: false })
        .limit(1);

      if (findError || !activeTimers || activeTimers.length === 0) {
        return Response.json(
          { error: '실행 중인 타이머가 없습니다' },
          { status: 404 }
        );
      }

      const activeTimer = activeTimers[0];

      // 공부 시간 업데이트
      const { data, error } = await supabase
        .from('StudyTime')
        .update({
          시간: studyTime, // 분 단위
          SaveTimeID: new Date().toISOString(),
        })
        .eq('저장시각아이디', activeTimer.저장시각아이디)
        .select()
        .single();

      if (error) {
        console.error('Pause timer error:', error);
        return Response.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return Response.json({
        message: '타이머가 일시정지되었습니다',
        timer: data,
      }, { status: 200 });

    } else if (action === 'reset') {
      // 타이머 리셋 - 활성 타이머 삭제
      const { error } = await supabase
        .from('StudyTime')
        .delete()
        .eq('학습자아이디', user.id)
        .is('SaveTimeID', null);

      if (error) {
        console.error('Reset timer error:', error);
        return Response.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return Response.json({
        message: '타이머가 리셋되었습니다',
      }, { status: 200 });

    } else {
      return Response.json(
        { error: '올바르지 않은 action입니다' },
        { status: 400 }
      );
    }

  } catch (err) {
    console.error('POST /api/main/studytime error:', err);
    return Response.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}