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
      .eq('UserID', user.id)
      .gte('saveTime', today.toISOString())
      .lt('saveTime', tomorrow.toISOString())
      .order('saveTime', { ascending: true });

    if (error) {
      console.error('StudyTime query error:', error);
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // 5. 총 공부시간 계산 (분 단위)
    const totalStudyTime = studyTimes.reduce((total, record) => {
      return total + (record.studyTime || 0);
    }, 0);

    // 6. 현재 활성화된 타이머 확인 (studyTime이 아직 0인 레코드)
    const activeTimer = studyTimes.find(record => record.isActive === true);

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
      // 기존에 활성화된 타이머 확인 및 정리
      const { data: existingTimers } = await supabase
        .from('StudyTime')
        .select('*')
        .eq('UserID', user.id)
        .eq('isActive', true);

      // 기존 활성 타이머가 있으면 모두 비활성화 (정리)
      if (existingTimers && existingTimers.length > 0) {
        console.log('기존 활성 타이머 정리:', existingTimers.length, '개');
        await supabase
          .from('StudyTime')
          .update({ isActive: false })
          .eq('UserID', user.id)
          .eq('isActive', true);
      }

      // 타이머 시작 - 새로운 기록 생성
      const { data, error } = await supabase
        .from('StudyTime')
        .insert([{
          UserID: user.id,
          studyTime: 0, // 초기값 0분
          saveTime: new Date().toISOString(),
          isActive: true, // 진행 중 표시
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
      if (studyTime === undefined || studyTime === null) {
        return Response.json(
          { error: '공부시간 정보가 필요합니다' },
          { status: 400 }
        );
      }

      // 현재 활성 타이머 찾기
      const { data: activeTimer, error: findError } = await supabase
        .from('StudyTime')
        .select('*')
        .eq('UserID', user.id)
        .eq('isActive', true)
        .order('saveTime', { ascending: false })
        .limit(1)
        .single();

      if (findError || !activeTimer) {
        return Response.json(
          { error: '실행 중인 타이머가 없습니다' },
          { status: 404 }
        );
      }

      // 공부 시간 업데이트
      const { data, error } = await supabase
        .from('StudyTime')
        .update({
          studyTime: studyTime, // 분 단위
          isActive: false, // 비활성화
        })
        .eq('SaveTimeID', activeTimer.SaveTimeID)
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

    } else if (action === 'save') {
      // 타이머 저장 - 총 공부시간에 누적
      if (studyTime === undefined || studyTime === null) {
        return Response.json(
          { error: '공부시간 정보가 필요합니다' },
          { status: 400 }
        );
      }

      // 현재 활성 타이머 찾기
      const { data: activeTimers, error: findError } = await supabase
        .from('StudyTime')
        .select('*')
        .eq('UserID', user.id)
        .eq('isActive', true)
        .order('saveTime', { ascending: false });

      if (findError) {
        console.error('Find active timer error:', findError);
      }

      let savedTimer = null;

      // 활성 타이머가 있으면 첫 번째 것을 업데이트
      if (activeTimers && activeTimers.length > 0) {
        const activeTimer = activeTimers[0];

        const { data, error } = await supabase
          .from('StudyTime')
          .update({
            studyTime: studyTime, // 분 단위
            isActive: false, // 완료 상태
          })
          .eq('SaveTimeID', activeTimer.SaveTimeID)
          .select()
          .single();

        if (error) {
          console.error('Save timer error (update):', error);
          return Response.json(
            { error: error.message },
            { status: 400 }
          );
        }

        savedTimer = data;

        // 나머지 활성 타이머들도 모두 비활성화
        if (activeTimers.length > 1) {
          await supabase
            .from('StudyTime')
            .update({ isActive: false })
            .eq('UserID', user.id)
            .eq('isActive', true)
            .neq('SaveTimeID', activeTimer.SaveTimeID);
        }
      } else {
        // 활성 타이머가 없으면 새로 생성
        const { data, error } = await supabase
          .from('StudyTime')
          .insert([{
            UserID: user.id,
            studyTime: studyTime, // 분 단위
            saveTime: new Date().toISOString(),
            isActive: false, // 완료 상태
          }])
          .select()
          .single();

        if (error) {
          console.error('Save timer error (insert):', error);
          return Response.json(
            { error: error.message },
            { status: 400 }
          );
        }

        savedTimer = data;
      }

      return Response.json({
        message: '타이머가 저장되었습니다',
        timer: savedTimer,
      }, { status: 200 });

    } else if (action === 'reset') {
      // 타이머 리셋 - 활성 타이머 삭제
      const { error } = await supabase
        .from('StudyTime')
        .delete()
        .eq('UserID', user.id)
        .eq('isActive', true);

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