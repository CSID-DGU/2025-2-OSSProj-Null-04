# 📚 StudyRoom (스터디룸)

> **AI 기반 그룹 협업 학습 플랫폼** > 효율적인 학습 자료 공유, AI 퀴즈 생성, 그리고 그룹 토론을 통해 학습 효율을 극대화하는 서비스입니다.

## 📝 프로젝트 소개 (Project Overview)

**StudyRoom**은 기존 오프라인 스터디의 시공간적 제약과 자료 공유의 비효율성을 해결하기 위해 개발되었습니다.  
사용자가 학습 자료(PDF, TXT)를 업로드하면 AI가 자동으로 퀴즈를 생성하고, 학습자들은 그룹 내에서 오답을 분석하고 토론하며 함께 성장할 수 있습니다.

### 🎯 핵심 목표
* **자료 기반 학습:** 대용량 파일을 업로드하고 이를 기반으로 학습합니다.
* **AI 튜터링:** GPT-5.1 기반의 퀴즈 생성 및 RAG(검색 증강 생성) 기술을 활용한 질의응답을 제공합니다.
* **그룹 협업:** 오답률이 높은 문제를 자동으로 분석하여 그룹원들과 집중적으로 토론할 수 있습니다.

---

## 🛠 기술 스택 (Tech Stack)

| 분류 | 기술 (Technology) |
| :--- | :--- |
| **Framework** | **Next.js 15** (App Router, Turbopack) |
| **Language** | JavaScript (ES6+) |
| **Styling** | TailwindCSS 4 |
| **State Mgt** | TanStack Query (React Query) |
| **Database** | **Supabase** (PostgreSQL, Auth, Storage, pgvector) |
| **AI Model** | **OpenAI GPT-5.1** (Thinking Model), Embedding (text-embedding-3-small) |
| **OCR** | Google Cloud Vision API |
| **Deployment** | Vercel |

---

## ✨ 주요 기능 (Key Features)

1.  **📂 스마트한 파일 관리**
    * Presigned URL 방식을 통한 대용량 학습 자료 보안 업로드
    * 업로드된 파일의 텍스트 자동 추출 및 벡터화 (Vectorization)

2.  **📝 AI 퀴즈 자동 생성**
    * **GPT-5.1**을 활용한 고품질 객관식 퀴즈 생성
    * 난이도(쉬움/보통/어려움) 및 문제 수 설정 가능
    * 생성된 문제에 대한 상세 해설 제공

3.  **🤖 AI 학습 도우미 (RAG Chat)**
    * 학습 자료 내용을 기반으로 답변하는 AI 챗봇
    * 문맥을 파악하여 스트리밍 방식으로 실시간 답변 제공

4.  **📊 그룹 학습 및 분석**
    * PIN 코드를 통한 간편한 스터디룸 입장
    * 그룹원들의 오답 데이터를 분석하여 '많이 틀린 문제' 우선 노출
    * 문제별 댓글 및 토론 기능

5.  **📅 학습 관리**
    * 스터디 일정 관리 (캘린더 View)
    * 뽀모도로 타이머를 통한 집중 학습 지원

---
## 🚀 시작하기 (Getting Started)

이 프로젝트를 로컬 환경에서 실행하거나 배포하기 위한 가이드입니다.

### 1. 레포지토리 클론 (Clone)

먼저 프로젝트 코드를 로컬로 가져옵니다.

```bash
git clone [https://github.com/your-username/studyroom.git](https://github.com/your-username/studyroom.git)
cd studyroom
```
### 2. 패키지 설치 (Install Dependencies)
프로젝트 실행에 필요한 의존성 패키지를 설치합니다.
```bash
npm install
# 또는
yarn install
```
### 3. 환경 변수 설정 (Environment Variables)
프로젝트 루트 경로에 .env.local 파일을 생성하고, 아래의 필수 환경 변수들을 설정해야 합니다.
```bash
# 1. Supabase 설정 (Database & Auth) [cite: 105]
# Supabase 대시보드 -> Project Settings -> API에서 확인 가능
NEXT_PUBLIC_SUPABASE_URL=[https://your-project.supabase.co](https://your-project.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ROOM_FILES_BUCKET=room-files

# 2. OpenAI 설정 (AI Quiz & Chat) [cite: 110]
# GPT-5.1 및 Embedding 사용을 위한 API Key
OPENAI_API_KEY=sk-proj-...

# 3. Google Cloud 설정 (OCR & Vision) [cite: 112]
# Vision API 사용을 위한 인증 정보 (JSON 문자열 형태)
GOOGLE_APPLICATION_CREDENTIALS={...JSON_STRING...}
GOOGLE_API_KEY=your-google-api-key
GOOGLE_OCR_GCS_BUCKET=your-bucket-name
```
### 4. 실행 (Run)
환경 변수 설정이 완료되면 개발 서버를 실행합니다.
```bash
npm run dev
```
브라우저 주소창에 http://localhost:3000을 입력하여 서비스를 확인하세요.

---

## 🖥️ 화면 UI
### 1. 온보딩화면
<img width="1892" height="1027" alt="image" src="https://github.com/user-attachments/assets/d5946bf2-1780-4d4a-a786-d1f53dc2b4bc" />

### 2. 대시보드
<img width="1896" height="1037" alt="image" src="https://github.com/user-attachments/assets/058e0fa9-dc65-41cd-931b-fc8ba217b1e7" />

### 3. 파일 업로드
<img width="1887" height="1031" alt="image" src="https://github.com/user-attachments/assets/25340a0f-8e6a-4fbe-853b-7b2273a23a55" />

### 4. 퀴즈 생성
<img width="1880" height="1035" alt="image" src="https://github.com/user-attachments/assets/13636d18-2d04-4448-81fb-2ed6d7fa287d" />

### 5. 퀴즈 풀이
<img width="1876" height="1030" alt="image" src="https://github.com/user-attachments/assets/751ee5df-d053-41f2-969e-a5d60faf4cfd" />

### 6. 그룹 학습
<img width="1892" height="1030" alt="image" src="https://github.com/user-attachments/assets/0a760af3-20ba-42da-9d66-be3ed53e0b61" />

---
## 📂 폴더 구조 (Directory Structure)
본 프로젝트는 Next.js 15 App Router 구조를 따르고 있습니다.
```bash
studyroom/
├── app/                    # App Router 메인 디렉토리
│   ├── api/                # 백엔드 API Routes [cite: 60]
│   │   ├── auth/           # 로그인, 회원가입, 로그아웃
│   │   ├── room/           # 강의실 생성/참여 및 파일 관리
│   │   ├── quiz/           # AI 퀴즈 생성 및 제출
│   │   └── chat/           # RAG 기반 AI 학습 채팅
│   ├── (auth)/             # 인증 관련 페이지 그룹
│   ├── room/               # 스터디룸 및 학습 화면
│   └── dashboard/          # 사용자 대시보드
├── components/             # UI 컴포넌트 [cite: 68]
│   ├── layout/             # Sidebar, Header, Footer
│   └── ui/                 # 공통 UI 컴포넌트
├── lib/                    # 유틸리티 및 설정 [cite: 71]
│   ├── supabase/           # Supabase 클라이언트 설정
│   └── auth.js             # 인증 관련 헬퍼 함수
└── public/                 # 정적 파일 (Images, Fonts) [cite: 74]
```
---
## ⚠️ 트러블슈팅 (Troubleshooting)

| 문제 (Problem) | 해결 방법 (Solution) |
| :--- | :--- |
| **파일 업로드 실패 (4.5MB 초과)** | Vercel의 용량 제한을 우회하기 위해 **Presigned URL 방식**을 사용하여 클라이언트에서 직접 업로드해야 합니다. |
| **인증 에러** | JWT 토큰이 만료되었을 수 있습니다. **로그아웃 후 재로그인**을 시도해 주세요. |
| **퀴즈 생성 느림** | **GPT-5.1 Thinking 모델**의 특성상 복잡한 추론 과정으로 인해 시간이 소요될 수 있으며, 이는 정상 동작입니다. |
| **벡터 검색 결과 없음** | 파일 업로드 후 **벡터화(Embedding)** 작업이 완료되었는지 `FileChunk` 테이블을 확인하세요. |
| **로그아웃 후 캐시 문제** | 로그아웃 시 **TanStack Query 캐시 초기화** 및 `localStorage` 정리가 올바르게 수행되는지 확인이 필요합니다. |
---
## 👥 팀원 (Team)
- 박성준 (팀장 / 경영학과) 
- 김성민 (팀원 / 생명과학과) 
- 유형승 (팀원 / 국제통상학과)
