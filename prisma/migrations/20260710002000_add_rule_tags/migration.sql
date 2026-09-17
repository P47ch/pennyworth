-- CreateTable
CREATE TABLE "RuleTag" (
    "ruleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "RuleTag_pkey" PRIMARY KEY ("ruleId","tagId")
);

-- CreateIndex
CREATE INDEX "RuleTag_tagId_idx" ON "RuleTag"("tagId");

-- AddForeignKey
ALTER TABLE "RuleTag" ADD CONSTRAINT "RuleTag_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleTag" ADD CONSTRAINT "RuleTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
