import { requireAuth } from '@/lib/auth';
import Sidebar from '@/components/layout/Sidebar';

export default async function DashboardLayout({ children }) {
    // 로그인 필수
    const user = await requireAuth();

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* 사이드바 */}
            <Sidebar user={user} />

            {/* 메인 콘텐츠 영역 */}
            <div className="flex-1 sidebar-expanded-content">
                {children}
            </div>
        </div>
    );
}
