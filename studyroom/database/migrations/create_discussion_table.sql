-- Discussion 테이블 생성
CREATE TABLE IF NOT EXISTS "Discussion" (
  "DiscussionID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "RoomID" UUID NOT NULL,
  "UserID" UUID NOT NULL,
  "Content" TEXT NOT NULL,
  "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 외래키 제약조건
  CONSTRAINT fk_discussion_room FOREIGN KEY ("RoomID") REFERENCES "Room"("RoomID") ON DELETE CASCADE,
  CONSTRAINT fk_discussion_user FOREIGN KEY ("UserID") REFERENCES "User"("UserID") ON DELETE CASCADE
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_discussion_room ON "Discussion" ("RoomID", "CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_user ON "Discussion" ("UserID");

-- Row Level Security (RLS) 활성화
ALTER TABLE "Discussion" ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 강의실 멤버만 해당 강의실의 토의를 볼 수 있음
CREATE POLICY "강의실 멤버는 토의를 볼 수 있음"
  ON "Discussion"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "RoomMember"
      WHERE "RoomMember"."RoomID" = "Discussion"."RoomID"
        AND "RoomMember"."UserID" = auth.uid()
    )
  );

-- RLS 정책: 강의실 멤버는 토의를 작성할 수 있음
CREATE POLICY "강의실 멤버는 토의를 작성할 수 있음"
  ON "Discussion"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "RoomMember"
      WHERE "RoomMember"."RoomID" = "Discussion"."RoomID"
        AND "RoomMember"."UserID" = auth.uid()
    )
    AND "UserID" = auth.uid()
  );

-- RLS 정책: 본인이 작성한 토의만 삭제할 수 있음
CREATE POLICY "본인 토의만 삭제 가능"
  ON "Discussion"
  FOR DELETE
  USING ("UserID" = auth.uid());
