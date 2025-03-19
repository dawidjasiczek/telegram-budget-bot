import { config } from 'dotenv';
import OpenAI from 'openai';
import { AnalyzeReceiptParams, OpenAIResponse } from '../types';
import { ResponseInputContent } from 'openai/resources/responses/responses';

config();

export class OpenAIClient {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Sends a request to the OpenAI API, passing an image (in base64 format) and user comment.
   * @param {AnalyzeReceiptParams} params - Request parameters.
   * @returns {Promise<OpenAIResponse>} - Response from the OpenAI API.
   */
  async analyzeReceipt({ imageBase64, userComment, categories = "" }: AnalyzeReceiptParams): Promise<OpenAIResponse> {
    const userContent: ResponseInputContent[] = [
      {
        type: "input_image",
        image_url: `data:image/jpeg;base64,${imageBase64}`,
        detail: "auto"
      }
    ];

    if (userComment.length) {
      userContent.push({
        type: "input_text",
        text: userComment
      });
    }

    try {
      const response = await this.openai.responses.create({
        model: "gpt-4o",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: `Extract essential data from a receipt while prioritizing the user's comment related to each item.
Consider store names and product descriptions to infer categories if required.
# Key Instructions
1. Prioritize interpreting the user's comment for each receipt item.
2. Identify store name and infer product categories if not explicit.
3. Extract total spent amount.
# Notes
- Categories to consider: ${categories}`
              }
            ]
          },
          {
            role: "user",
            content: userContent
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "receipt_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                store_name: {
                  type: "string",
                  description: "The name of the store where the receipt was issued."
                },
                products: {
                  type: "array",
                  description: "List of products purchased.",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        description: "The name of the product."
                      },
                      price: {
                        type: "number",
                        description: "The price of the product."
                      },
                      category: {
                        type: "string",
                        description: "The category to which the product belongs."
                      }
                    },
                    required: ["name", "price", "category"],
                    additionalProperties: false
                  }
                },
                total_amount: {
                  type: "number",
                  description: "The total amount spent on the receipt."
                }
              },
              required: ["store_name", "products", "total_amount"],
              additionalProperties: false
            }
          }
        },
        temperature: 1,
        max_output_tokens: 2048,
        top_p: 1,
        store: true
      });

      const parsedData = JSON.parse(response.output_text);

      return {
        data: parsedData,
        usage: {
          input_tokens: response.usage?.input_tokens ?? 0,
          output_tokens: response.usage?.output_tokens ?? 0,
          total_tokens: response.usage?.total_tokens ?? 0
        }
      };
    } catch (error) {
      console.error("Error while calling OpenAI API:", error);
      throw error;
    }
  }
} 