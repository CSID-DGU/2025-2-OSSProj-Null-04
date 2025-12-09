import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary-100 to-white dark:from-gray-900 dark:to-gray-800">
      <main className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6">
          스터디룸
        </h1>

        <p className="text-xl sm:text-2xl text-gray-700 dark:text-gray-300 mb-4 max-w-2xl">
          효율적인 그룹 학습 시스템
        </p>

        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mb-12 max-w-xl">
          자료 공유부터 문제생성 및 풀이, 토론까지 한 곳에서 간편하게
        </p>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <Link
            href="/login"
            className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-base sm:text-lg px-8 py-3 transition-colors duration-200 shadow-lg hover:shadow-xl w-full sm:w-auto min-w-[140px]"
          >
            로그인
          </Link>

          <Link
            href="/register"
            className="rounded-lg border-2 border-primary-600 text-primary-600 hover:bg-primary-100 dark:hover:bg-gray-700 font-semibold text-base sm:text-lg px-8 py-3 transition-colors duration-200 w-full sm:w-auto min-w-[140px]"
          >
            회원가입
          </Link>
        </div>
      </main>

      <footer className="absolute bottom-8 text-sm text-gray-600 dark:text-gray-400">
        <p>© 2025 스터디룸. All rights reserved.</p>
      </footer>
    </div>
  );
}
