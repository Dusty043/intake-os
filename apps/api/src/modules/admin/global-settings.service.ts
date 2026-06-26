import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

const DEFAULTS: Record<string, string> = {
  "discovery.confidence_threshold": "0.65",
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

  async getDiscoverySettings(): Promise<{ confidenceThreshold: number }> {
    const raw = await this.get("discovery.confidence_threshold");
    const parsed = parseFloat(raw);
    return {
      confidenceThreshold: Number.isFinite(parsed) ? Math.max(0.1, Math.min(0.9, parsed)) : 0.65,
    };
  }

  async getConfidenceThreshold(): Promise<number> {
    const { confidenceThreshold } = await this.getDiscoverySettings();
    return confidenceThreshold;
  }
}
