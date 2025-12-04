/** @type {import('next').NextConfig} */
const nextConfig = {
    // API routes에서 큰 파일 업로드 지원
    api: {
        bodyParser: {
            sizeLimit: '50mb', // 파일 업로드 크기 제한 증가
        },
    },

    // Vercel 환경에서 serverless function 크기 제한 증가
    experimental: {
        serverActions: {
            bodySizeLimit: '50mb',
        },
    },
};

export default nextConfig;
