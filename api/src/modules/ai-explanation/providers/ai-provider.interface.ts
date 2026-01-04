export interface AiExplanationInput {
  invoiceAmount: string;
  invoiceDate?: string;
  invoiceVendor?: string;
  invoiceDescription?: string;
  invoiceNumber?: string;
  transactionAmount: string;
  transactionDate: string;
  transactionDescription?: string;
  heuristicScore: number;
}

export interface AiExplanationOutput {
  explanation: string;
  confidence: number; // 0-1
}

export interface IAiProvider {
  generateExplanation(input: AiExplanationInput): Promise<AiExplanationOutput>;
  isAvailable(): Promise<boolean>;
}
