import TokenLog from "../models/TokenLog.js";

export interface MetricsPerApiKeyItem {
    provider: string;
    totals: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        requests: number;
        unique_threads_count: number;
    };
}

export interface ThreadAgentItem {
    api_key_id: string;
    provider: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    requests: number;
    sourceType?: string;
    agentName?: string;
}

export interface AgentBreakdownItem {
    agentName: string;
    sourceType: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    requests: number;
    costUSD: number;
}

export interface ModelCostItem {
    model: string;
    provider: string;
    total_tokens: number;
    costUSD: number;
    requests: number;
    avgLatencyMs: number;
    tokensPerSec: number;
}

export const getTokenAnalytics = async (systemSlug?: string) => {
    const query = systemSlug && systemSlug !== "all" ? { systemSlug } : {};
    const logs = await TokenLog.find(query).sort({ createdAt: -1 }).lean().exec();

    let grand_total_input = 0;
    let grand_total_output = 0;
    let grand_total_all = 0;
    let grand_total_requests = 0;
    let total_cost_usd = 0;
    let total_duration_ms = 0;
    let success_count = 0;
    let fallback_count = 0;

    const externalStats = { input: 0, output: 0, total: 0, requests: 0, costUSD: 0 };
    const internalStats = { input: 0, output: 0, total: 0, requests: 0, costUSD: 0 };

    const agentMap: Record<string, AgentBreakdownItem> = {};
    const modelMap: Record<string, { provider: string; total_tokens: number; costUSD: number; requests: number; durationMs: number }> = {};

    const apiKeyMap: Record<string, { provider: string; input: number; output: number; total: number; reqs: number; threads: Set<string> }> = {};
    const threadMap: Record<string, Record<string, { provider: string; input: number; output: number; total: number; reqs: number }>> = {};

    for (const log of logs) {
        const input = log.promptTokens || 0;
        const output = log.completionTokens || 0;
        const total = log.totalTokens || input + output;
        const cost = log.costUSD || 0;
        const duration = log.durationMs || 0;
        const keyId = log.apiKeyId || "key_openai_prod_01";
        const threadId = log.threadId || "conv-brand-001";
        const provider = log.provider || "OpenAI";
        const sourceType = log.sourceType === "internal_agent" ? "internal_agent" : "external_api";
        const agentName = log.agentName || (sourceType === "internal_agent" ? "Background AI Agent" : "Public Chatbot API");

        grand_total_input += input;
        grand_total_output += output;
        grand_total_all += total;
        grand_total_requests += 1;
        total_cost_usd += cost;
        total_duration_ms += duration;

        if (log.status === "fallback") fallback_count++;
        else success_count++;

        // Source Type Division
        if (sourceType === "internal_agent") {
            internalStats.input += input;
            internalStats.output += output;
            internalStats.total += total;
            internalStats.requests += 1;
            internalStats.costUSD += cost;
        } else {
            externalStats.input += input;
            externalStats.output += output;
            externalStats.total += total;
            externalStats.requests += 1;
            externalStats.costUSD += cost;
        }

        // Agent Breakdown Grouping
        if (!agentMap[agentName]) {
            agentMap[agentName] = {
                agentName,
                sourceType,
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0,
                requests: 0,
                costUSD: 0,
            };
        }
        agentMap[agentName].input_tokens += input;
        agentMap[agentName].output_tokens += output;
        agentMap[agentName].total_tokens += total;
        agentMap[agentName].requests += 1;
        agentMap[agentName].costUSD += cost;

        // Model Performance Grouping
        const modelKey = log.model;
        if (!modelMap[modelKey]) {
            modelMap[modelKey] = {
                provider,
                total_tokens: 0,
                costUSD: 0,
                requests: 0,
                durationMs: 0,
            };
        }
        modelMap[modelKey].total_tokens += total;
        modelMap[modelKey].costUSD += cost;
        modelMap[modelKey].requests += 1;
        modelMap[modelKey].durationMs += duration;

        // API Key Grouping
        if (!apiKeyMap[keyId]) {
            apiKeyMap[keyId] = {
                provider,
                input: 0,
                output: 0,
                total: 0,
                reqs: 0,
                threads: new Set<string>(),
            };
        }
        apiKeyMap[keyId].input += input;
        apiKeyMap[keyId].output += output;
        apiKeyMap[keyId].total += total;
        apiKeyMap[keyId].reqs += 1;
        apiKeyMap[keyId].threads.add(threadId);

        // Thread Grouping
        if (!threadMap[threadId]) {
            threadMap[threadId] = {};
        }
        if (!threadMap[threadId][keyId]) {
            threadMap[threadId][keyId] = {
                provider,
                input: 0,
                output: 0,
                total: 0,
                reqs: 0,
            };
        }
        threadMap[threadId][keyId].input += input;
        threadMap[threadId][keyId].output += output;
        threadMap[threadId][keyId].total += total;
        threadMap[threadId][keyId].reqs += 1;
    }

    const metrics_per_api_key: Record<string, MetricsPerApiKeyItem> = {};
    for (const [keyId, val] of Object.entries(apiKeyMap)) {
        metrics_per_api_key[keyId] = {
            provider: val.provider,
            totals: {
                input_tokens: val.input,
                output_tokens: val.output,
                total_tokens: val.total,
                requests: val.reqs,
                unique_threads_count: val.threads.size,
            },
        };
    }

    const metrics_per_thread: Record<string, ThreadAgentItem[]> = {};
    for (const [threadId, keyGroup] of Object.entries(threadMap)) {
        metrics_per_thread[threadId] = Object.entries(keyGroup).map(([keyId, val]) => ({
            api_key_id: keyId,
            provider: val.provider,
            input_tokens: val.input,
            output_tokens: val.output,
            total_tokens: val.total,
            requests: val.reqs,
        }));
    }

    const model_cost_breakdown: ModelCostItem[] = Object.entries(modelMap).map(([model, val]) => {
        const avgLat = val.requests ? Math.round(val.durationMs / val.requests) : 0;
        const durationSec = val.durationMs ? val.durationMs / 1000 : 1;
        const speed = durationSec ? Number((val.total_tokens / durationSec).toFixed(1)) : 0;

        return {
            model,
            provider: val.provider,
            total_tokens: val.total_tokens,
            costUSD: Number(val.costUSD.toFixed(4)),
            requests: val.requests,
            avgLatencyMs: avgLat,
            tokensPerSec: speed,
        };
    });

    const avgLatencyMs = grand_total_requests ? Math.round(total_duration_ms / grand_total_requests) : 0;
    const totalSec = total_duration_ms ? total_duration_ms / 1000 : 1;
    const avgTokensPerSec = totalSec ? Number((grand_total_all / totalSec).toFixed(1)) : 0;
    const successRate = grand_total_requests ? Math.round((success_count / grand_total_requests) * 100) : 100;
    const fallbackRate = 100 - successRate;
    const costPerThousand = grand_total_all ? Number(((total_cost_usd / grand_total_all) * 1000).toFixed(4)) : 0;

    return {
        overall_totals: {
            grand_total_input,
            grand_total_output,
            grand_total_all,
            grand_total_requests,
            total_cost_usd: Number(total_cost_usd.toFixed(4)),
        },
        external_vs_internal: {
            external_api: externalStats,
            internal_agent: internalStats,
        },
        agent_breakdown: Object.values(agentMap),
        model_cost_breakdown,
        performance_metrics: {
            avgLatencyMs,
            avgTokensPerSec,
            successRate,
            fallbackRate,
            costPerThousand,
        },
        metrics_per_api_key,
        metrics_per_thread,
    };
};

export const getTokenLogsForApiKeyService = async (
    apiKeyId: string,
    limit = 50,
    skip = 0,
) => {
    const query = { apiKeyId };
    const [total, logs] = await Promise.all([
        TokenLog.countDocuments(query),
        TokenLog.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec(),
    ]);

    return {
        apiKeyId,
        logs: logs.map((l) => ({
            id: l.publicId,
            apiKeyId: l.apiKeyId,
            threadId: l.threadId,
            sourceType: l.sourceType,
            agentName: l.agentName,
            model: l.model,
            provider: l.provider,
            promptTokens: l.promptTokens,
            completionTokens: l.completionTokens,
            totalTokens: l.totalTokens,
            durationMs: l.durationMs,
            costUSD: l.costUSD,
            status: l.status,
            createdAt: l.createdAt,
        })),
        total_log_records: total,
        limit,
        skip,
    };
};
