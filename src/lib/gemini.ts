/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function generatePerformanceSummary(playerName: string, stats: any) {
  if (!process.env.GEMINI_API_KEY) {
    return "API Key not configured. Please add GEMINI_API_KEY to your secrets.";
  }

  const prompt = `
    Como Arquitecto de Soluciones Deportivas e IA, analiza el rendimiento del jugador ${playerName}.
    Datos estadísticos actuales: ${JSON.stringify(stats)}.
    
    INSTRUCCIÓN CRÍTICA: Basa tu análisis EXCLUSIVAMENTE en los datos proporcionados arriba. NO inventes estadísticas, fechas o métricas que no estén en el objeto 'stats'. Si falta información para algún punto, indica simplemente que no hay datos suficientes.

    Genera un resumen ejecutivo breve (máximo 3 párrafos) que incluya:
    1. Análisis táctico basado en la métrica.
    2. Alerta de salud/wellness si existe correlación negativa entre esfuerzo (RPE) y bienestar.
    3. Recomendación de entrenamiento específico.
    
    Responde en Español, con tono profesional y técnico.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "No se pudo generar el resumen.";
  } catch (error) {
    console.error("Error generating AI summary:", error);
    return "Error al generar el resumen de IA.";
  }
}

export async function extractMatchStatsFromFile(base64Data: string, mimeType: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no configurado.");
  }

  const prompt = `
    Actúa como un transcriptor OCR de precisión absoluta para actas de baloncesto. Sigue estas reglas estrictas: 
    1) Analiza la tabla de izquierda a derecha. 
    2) Si hay encabezados agrupados (dos filas de cabeceras), concatena la fila superior con la inferior para crear nombres únicos (ejemplo: 'TC 2P A/I', 'TC 2P %', 'Rebotes DEF', 'FAL FC'). 
    3) Si una columna no existe en la imagen, NO te la inventes. 
    4) Devuelve un objeto JSON estricto con dos propiedades: 'headers' (un array de strings con los nombres únicos de las columnas, en el orden EXACTO en el que aparecen de izquierda a derecha) y 'players' (un array de objetos donde las claves son exactamente los strings del array 'headers').
    Devuelve SOLO código JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          }
        ]
      }
    });
    
    const text = response.text || '';
    // Clean potential markdown code blocks
    const cleanedText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error extracting stats from vision:", error);
    throw new Error("No se pudo extraer la información del acta.");
  }
}
