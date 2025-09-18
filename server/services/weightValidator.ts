import type { WeightReading, ToleranceCheck } from "@shared/schema";

export interface ValidationConfig {
  toleranceRange: number; // in kg
  weightSourcePriority: "plc" | "serial" | "average";
  validationAction: "log" | "review" | "block";
}

export class WeightValidator {
  private config: ValidationConfig;

  constructor(config: ValidationConfig) {
    this.config = config;
  }

  validateWeights(reading: WeightReading): ToleranceCheck {
    const { plcWeight, serialWeight } = reading;
    
    if (!plcWeight && !serialWeight) {
      throw new Error("No weight readings available");
    }

    if (!plcWeight || !serialWeight) {
      // Only one source available
      const finalWeight = plcWeight || serialWeight!;
      return {
        difference: 0,
        tolerance: this.config.toleranceRange,
        status: "good",
        finalWeight,
        weightSource: plcWeight ? "plc" : "serial"
      };
    }

    // Both sources available - compare
    const difference = Math.abs(plcWeight - serialWeight);
    const toleranceStatus = this.getToleranceStatus(difference);
    const finalWeight = this.calculateFinalWeight(plcWeight, serialWeight);
    const weightSource = this.getWeightSource(plcWeight, serialWeight);

    return {
      difference,
      tolerance: this.config.toleranceRange,
      status: toleranceStatus,
      finalWeight,
      weightSource
    };
  }

  private getToleranceStatus(difference: number): "good" | "warning" | "error" {
    const { toleranceRange } = this.config;
    
    if (difference <= toleranceRange) {
      return "good";
    } else if (difference <= toleranceRange * 2) {
      return "warning";
    } else {
      return "error";
    }
  }

  private calculateFinalWeight(plcWeight: number, serialWeight: number): number {
    switch (this.config.weightSourcePriority) {
      case "plc":
        return plcWeight;
      case "serial":
        return serialWeight;
      case "average":
        return (plcWeight + serialWeight) / 2;
      default:
        return plcWeight; // Default to PLC
    }
  }

  private getWeightSource(plcWeight: number, serialWeight: number): "plc" | "serial" | "average" {
    switch (this.config.weightSourcePriority) {
      case "plc":
        return "plc";
      case "serial":
        return "serial";
      case "average":
        return "average";
      default:
        return "plc";
    }
  }

  updateConfig(newConfig: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ValidationConfig {
    return { ...this.config };
  }

  shouldBlockWeighment(toleranceCheck: ToleranceCheck): boolean {
    if (this.config.validationAction !== "block") {
      return false;
    }
    
    return toleranceCheck.status === "error";
  }

  requiresManualReview(toleranceCheck: ToleranceCheck): boolean {
    if (this.config.validationAction === "review") {
      return toleranceCheck.status !== "good";
    }
    
    return false;
  }
}

// Default validator instance
export const weightValidator = new WeightValidator({
  toleranceRange: 0.05, // 50g tolerance
  weightSourcePriority: "plc",
  validationAction: "log"
});
