import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { SIMPLEBIZ_ORG_CONTEXT } from "../../../../../src/application/discovery/agents/org-context.js";

const DEFAULTS: Record<string, string> = {
  "discovery.confidence_threshold": "0.65",
  "discovery.org_context": SIMPLEBIZ_ORG_CONTEXT,
};

@Injectable()
export class GlobalSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<string> {
    const row = await this.prisma.globalSetting.findUnique({ where: { key } });
    return row?.value ?? DEFAULTS[key] ?? "";
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.globalSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getDiscoverySettings(): Promise<{ confidenceThreshold: number; orgContext: string }> {
    const [rawThreshold, rawOrgContext] = await Promise.all([
      this.get("discovery.confidence_threshold"),
      this.get("discovery.org_context"),
    ]);
    const parsed = parseFloat(rawThreshold);
    return {
      confidenceThreshold: Number.isFinite(parsed) ? Math.max(0.1, Math.min(0.9, parsed)) : 0.65,
      orgContext: rawOrgContext || SIMPLEBIZ_ORG_CONTEXT,
    };
  }

  async getConfidenceThreshold(): Promise<number> {
    const { confidenceThreshold } = await this.getDiscoverySettings();
    return confidenceThreshold;
  }

  async getOrgContext(): Promise<string> {
    const { orgContext } = await this.getDiscoverySettings();
    return orgContext;
  }
}
