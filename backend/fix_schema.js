const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf16le');
if (!schema.includes('model')) {
  schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
}
const lines = schema.split('\n');
const cleanLines = lines.slice(0, 1372); // We saw line 1373 was the start of the corruption
const append = `
model ModerationReport {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  type         String    @db.VarChar(50)
  title        String    @db.VarChar(200)
  preview      String?
  severity     String    @db.VarChar(20)
  reporter     String    @db.VarChar(100)
  target       String    @db.VarChar(50)
  targetDetail String    @db.VarChar(255)
  unread       Boolean   @default(true)
  fullBody     String?
  flaggedWords Json?     @default("[]")
  apiLogs      Json?     @default("[]")
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime  @default(now()) @map("updated_at") @db.Timestamptz(6)

  @@map("moderation_reports")
}
`;
fs.writeFileSync('prisma/schema.prisma', cleanLines.join('\n') + append);
console.log('Fixed schema');
