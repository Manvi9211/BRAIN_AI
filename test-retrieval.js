const { retrieve } = require('./server/lib/retrieval');

function runTest(query) {
  console.log(`\n========================================`);
  console.log(`QUERY: "${query}"`);
  console.log(`========================================`);

  const { retrievedChunks, confidenceScore } = retrieve(query, 3, 0.05);

  console.log(`CONFIDENCE SCORE: ${confidenceScore}%`);
  console.log(`RETRIEVED CHUNKS: ${retrievedChunks.length}\n`);

  retrievedChunks.forEach((chunk, index) => {
    console.log(`[#${index + 1}] Source: ${chunk.title} (${chunk.doc_id})`);
    console.log(`     Index: Paragraph ${chunk.index} | Match Score: ${chunk.score.toFixed(4)}`);
    console.log(`     Snippet: "${chunk.text.substring(0, 150)}..."`);
    console.log(`     Tags: [${chunk.tags.join(', ')}]`);
    console.log(`----------------------------------------`);
  });
}

// Test queries targeting specific documents in our simulated corpus
runTest("What are the vibration limits for pump PMP-302?");
runTest("How to start Boiler B-401 burner and purging requirements?");
runTest("How often do we need to test fire water pumps under OISD standards?");
runTest("Are there any issues reported on Compressor C-102 bearings?");
runTest("What was the root cause of the complete seizure of PMP-302 in July?");
runTest("What is the operating steam pressure for B-401?");
runTest("Give me information on steam turbine startup temperature"); // Should return low confidence/refusal score
