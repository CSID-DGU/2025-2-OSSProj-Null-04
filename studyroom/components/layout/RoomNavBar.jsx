'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function RoomNavBar({ roomId }) {
  const pathname = usePathname();

  const tabs = [
    { name: '파일관리', path: `/room/${roomId}/file` },
    { name: '퀴즈', path: `/room/${roomId}/quiz` },
    { name: '그룹학습', path: `/room/${roomId}/group` },
    { name: '일정관리', path: `/room/${roomId}/schedule` },
  ];

  const isActive = (path) => pathname === path;

  return (
    <nav className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex gap-1 px-6">
        {tabs.map((tab) => (
          <Link
            key={tab.path}
            href={tab.path}
            className={`px-6 py-4 font-medium border-b-2 transition-colors ${
              isActive(tab.path)
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300'
            }`}
          >
            {tab.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
