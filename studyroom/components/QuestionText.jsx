'use client';

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

/**
 * 질문 텍스트를 렌더링하는 컴포넌트
 * - 코드 블록 (```) 지원
 * - 인라인 코드 (`) 지원
 * - Markdown 기본 포맷 (굵게, 기울임 등) 지원
 */
export default function QuestionText({ text, className = '' }) {
    return (
        <div className={`question-text ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // 코드 블록 처리
                    code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');

                        if (!inline && match) {
                            // 코드 블록 (```)
                            return (
                                <div className="my-4">
                                    <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        className="rounded-lg !my-0"
                                        customStyle={{
                                            margin: 0,
                                            borderRadius: '0.5rem',
                                            fontSize: '0.9em'
                                        }}
                                    >
                                        {codeString}
                                    </SyntaxHighlighter>
                                </div>
                            );
                        } else if (!inline) {
                            // 언어 지정 없는 코드 블록
                            return (
                                <div className="my-4">
                                    <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language="text"
                                        PreTag="div"
                                        className="rounded-lg !my-0"
                                        customStyle={{
                                            margin: 0,
                                            borderRadius: '0.5rem',
                                            fontSize: '0.9em'
                                        }}
                                    >
                                        {codeString}
                                    </SyntaxHighlighter>
                                </div>
                            );
                        } else {
                            // 인라인 코드 (`)
                            return (
                                <code
                                    className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-sm font-mono"
                                    {...props}
                                >
                                    {children}
                                </code>
                            );
                        }
                    },
                    // 굵게
                    strong({ children }) {
                        return <strong className="font-bold text-gray-900 dark:text-white">{children}</strong>;
                    },
                    // 기울임
                    em({ children }) {
                        return <em className="italic text-gray-700 dark:text-gray-300">{children}</em>;
                    },
                    // 단락
                    p({ children }) {
                        return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
                    },
                    // 목록
                    ul({ children }) {
                        return <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>;
                    },
                    ol({ children }) {
                        return <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>;
                    },
                    li({ children }) {
                        return <li className="text-gray-700 dark:text-gray-300">{children}</li>;
                    },
                    // 인용구
                    blockquote({ children }) {
                        return (
                            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-2 my-3 bg-gray-50 dark:bg-gray-800 rounded-r">
                                {children}
                            </blockquote>
                        );
                    }
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}
