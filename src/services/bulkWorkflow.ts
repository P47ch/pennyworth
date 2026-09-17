/**
 * Shared limits for the bounded, atomic bulk workflows. The batch size stays
 * below PostgreSQL's bind-parameter ceiling for the widest current rows while
 * avoiding one round trip per record.
 */
export const bulkWorkflowBatchSize = 2_000;
export const bulkWorkflowTransactionTimeoutMs = 120_000;
export const bulkWorkflowTransactionMaxWaitMs = 10_000;
