'use client';

import { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

/**
 * 퀴즈 문제지 DOCX 생성 및 다운로드 (개선 버전)
 * - 가독성 향상: 문제/선택지 간격, 폰트 크기 최적화
 * - 답안 공간: 깔끔한 공백 (밑줄 제거)
 * - 구조화: 명확한 섹션 구분
 */
export async function generateQuizDocument(quiz, questions, includeAnswers = false) {
    const children = [];

    // === 표지 ===
    children.push(new Paragraph({
        children: [
            new TextRun({
                text: quiz.QuizTitle,
                font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                size: 56, // 28pt
                bold: true
            })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
    }));

    children.push(new Paragraph({
        children: [
            new TextRun({
                text: `생성일: ${new Date().toLocaleDateString('ko-KR')}`,
                font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                size: 22,
                color: '666666'
            })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
    }));

    // 총 문제 수
    children.push(new Paragraph({
        children: [
            new TextRun({
                text: `총 ${questions.length}문제`,
                font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                size: 24,
                color: '444444'
            })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 }
    }));

    // === 문제들 ===
    questions.forEach((q, index) => {
        const questionType = q.questionType || 'MCQ';
        const typeLabel = {
            'MCQ': '객관식',
            'short': '단답형',
            'essay': '서술형'
        }[questionType] || '객관식';

        // 문제 번호 + 유형
        children.push(new Paragraph({
            children: [
                new TextRun({
                    text: `${index + 1}. `,
                    font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                    bold: true,
                    size: 28
                }),
                new TextRun({
                    text: `[${typeLabel}]`,
                    font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                    size: 22,
                    color: '0066CC',
                    bold: true
                })
            ],
            spacing: { before: 400, after: 100 }
        }));

        // 문제 내용
        children.push(new Paragraph({
            children: [
                new TextRun({
                    text: q.question,
                    font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                    size: 26
                })
            ],
            spacing: { after: 200 },
            indent: { left: 200 }
        }));

        // 객관식 선택지
        if (questionType === 'MCQ') {
            ['A', 'B', 'C', 'D'].forEach(option => {
                if (q[`option${option}`]) {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: `${option}. `,
                                font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                                size: 24,
                                bold: true
                            }),
                            new TextRun({
                                text: q[`option${option}`],
                                font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                                size: 24
                            })
                        ],
                        spacing: { after: 100 },
                        indent: { left: 400 }
                    }));
                }
            });

            // 객관식 답안 공간 (선택지 아래)
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: '답: ',
                        font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                        size: 24,
                        bold: true
                    })
                ],
                spacing: { before: 200, after: 100 },
                indent: { left: 400 }
            }));
        }

        // 단답형: 깔끔한 답안 공간
        if (questionType === 'short') {
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: '답: ',
                        font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                        size: 24,
                        bold: true
                    })
                ],
                spacing: { before: 200, after: 400 },
                indent: { left: 400 }
            }));
        }

        // 서술형: 충분한 답안 공간 (밑줄 제거, 여백으로 대체)
        if (questionType === 'essay') {
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: '답안:',
                        font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                        size: 24,
                        bold: true
                    })
                ],
                spacing: { before: 200, after: 100 },
                indent: { left: 400 }
            }));

            // 여백 (빈 줄들)
            for (let i = 0; i < 6; i++) {
                children.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: ' ',
                            size: 24
                        })
                    ],
                    spacing: { after: 200 }
                }));
            }
        }

        // 구분선 (문제 사이)
        if (index < questions.length - 1) {
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: '',
                        size: 12
                    })
                ],
                spacing: { after: 200 },
                border: {
                    bottom: {
                        color: 'CCCCCC',
                        space: 1,
                        style: 'single',
                        size: 6
                    }
                }
            }));
        }
    });

    // === 정답지 (옵션) ===
    if (includeAnswers) {
        children.push(new Paragraph({ children: [new PageBreak()] }));

        children.push(new Paragraph({
            children: [
                new TextRun({
                    text: '정답 및 해설',
                    font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                    size: 48,
                    bold: true
                })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 }
        }));

        questions.forEach((q, index) => {
            const questionType = q.questionType || 'MCQ';
            let answer = '';

            if (questionType === 'MCQ') {
                answer = `${q.correctAnswer}. ${q[`option${q.correctAnswer}`] || ''}`;
            } else if (questionType === 'short') {
                answer = Array.isArray(q.correctAnswer)
                    ? q.correctAnswer.join(', ')
                    : q.correctAnswer;
            } else if (questionType === 'essay') {
                answer = q.correctAnswer || '';
            }

            // 정답
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: `${index + 1}. `,
                        font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                        bold: true,
                        size: 26
                    }),
                    new TextRun({
                        text: '정답: ',
                        font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                        bold: true,
                        size: 26,
                        color: '0066CC'
                    }),
                    new TextRun({
                        text: answer,
                        font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                        size: 24
                    })
                ],
                spacing: { before: 300, after: 100 }
            }));

            // 해설
            if (q.explanation) {
                children.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: '해설: ',
                            font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                            size: 22,
                            bold: true,
                            color: '555555'
                        }),
                        new TextRun({
                            text: q.explanation,
                            font: { eastAsia: 'Malgun Gothic', ascii: 'Arial' },
                            size: 22,
                            color: '444444'
                        })
                    ],
                    spacing: { after: 200 },
                    indent: { left: 200 }
                }));
            }
        });
    }

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: 1440,    // 1인치
                        right: 1440,
                        bottom: 1440,
                        left: 1440
                    }
                }
            },
            children
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${quiz.QuizTitle}.docx`);
}
