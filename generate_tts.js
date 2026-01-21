// node test_ws.js "Hello world" "en-US-AriaNeural"

import WebSocket from 'ws';
import fs from 'fs';

async function generateSecMsGec(trustedClientToken) {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const windowsTicks = rounded * 10000000;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${windowsTicks}${trustedClientToken}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-xxxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

(async () => {
  // Get text and voice from command line arguments
  const args = process.argv.slice(2);
  const text = args[0] || "Xin chào, đây là bài kiểm tra chuyển văn bản thành giọng nói.";
  const voice = args[1] || "vi-VN-HoaiMyNeural";
  
  if (!args[0]) {
    console.log('Usage: node test_ws.js "<text>" [voice]');
    console.log('Example: node test_ws.js "Hello world" "en-US-AriaNeural"');
    console.log('\nUsing default values...\n');
  }
  
  const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  const req_id = generateUUID();
  const secMsGEC = await generateSecMsGec(TRUSTED_CLIENT_TOKEN);
  const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=${req_id}`;
  
  console.log('Connecting to:', url.substring(0, 100) + '...');
  console.log('Text to speech:', text);
  console.log('Voice:', voice);
  
  const audioChunks = [];
  
  const ws = new WebSocket(url, {
    headers: {
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "vi,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0",
      "Origin": "https://docxiu.net",
      "old-cms": "true"
    }
  });
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected successfully!');
    
    // Send configuration message
    const configMsg = `X-Timestamp:${new Date().toISOString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{
      "context": {
        "synthesis": {
          "audio": {
            "metadataoptions": { "sentenceBoundaryEnabled": "false", "wordBoundaryEnabled": "false" },
            "outputFormat": "audio-24khz-48kbitrate-mono-mp3"
          }
        }
      }
    }`;
    ws.send(configMsg);
    
    // Send SSML message
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'>
      <voice name='${voice}'>${text}</voice>
    </speak>`;
    
    const ssmlMsg = `X-RequestId:${req_id}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
    ws.send(ssmlMsg);
    
    console.log('📤 Sent TTS request');
  });
  
  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      // Audio data
      const separator = 'Path:audio\r\n';
      const dataString = data.toString('binary');
      const separatorIndex = dataString.indexOf(separator);
      
      if (separatorIndex !== -1) {
        const audioData = data.slice(separatorIndex + separator.length);
        audioChunks.push(audioData);
        console.log('🎵 Received audio chunk:', audioData.length, 'bytes');
      }
    } else {
      const message = data.toString();
      console.log('📥 Received message:', message.substring(0, 100));
      
      // Check if this is the turn.end message
      if (message.includes('Path:turn.end')) {
        console.log('✅ Audio generation completed');
        
        // Save audio file
        const audioBuffer = Buffer.concat(audioChunks);
        const outputFile = 'output.mp3';
        fs.writeFileSync(outputFile, audioBuffer);
        console.log(`💾 Saved audio to ${outputFile} (${audioBuffer.length} bytes)`);
        
        ws.close();
        process.exit(0);
      }
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    console.error('Error type:', typeof error);
    console.error('Error keys:', Object.keys(error));
    console.error('Error JSON:', JSON.stringify(error, null, 2));
    process.exit(1);
  });
  
  ws.on('close', () => {
    console.log('WebSocket closed');
  });
  
  setTimeout(() => {
    console.error('❌ Timeout after 10 seconds');
    ws.close();
    process.exit(1);
  }, 10000);
})();
