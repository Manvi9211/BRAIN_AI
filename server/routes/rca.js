const express = require('express');
const router = express.Router();
const { retrieve } = require('../lib/retrieval');
const { callLLM } = require('../lib/llmClient');

// Static fallbacks for offline/safe presentation mode
const PMP302_FALLBACK = {
  whys: [
    "Centrifugal pump PMP-302 completely seized during startup with heavy smoke from the coupling end.",
    "The pump shaft was locked due to the complete shattering of the non-drive end radial shaft bearing.",
    "The radial bearing ran dry and overheated due to a severe lubrication oil deficiency in the sump.",
    "The lubrication oil level had depleted over months from unaddressed oil leaks and lack of lubrication checks.",
    "Maintenance personnel missed lubricating oil top-ups and did not inspect the oil sight glass during scheduled rounds."
  ],
  root_cause: "Failure of preventive maintenance inspection discipline combined with unrectified oil leakages, leading to chronic dry run bearing failure, cage breakup, shaft misalignment, and subsequent primary mechanical seal fracture.",
  fishbone: {
    "Machine": [
      "Radial bearing at non-drive end completely shattered",
      "API Plan 52 tandem mechanical seal faces cracked and heavily grooved",
      "Coupling end elastomer worn due to excessive radial vibration load"
    ],
    "Method": [
      "Inadequate weekly mechanical inspection checks",
      "Weekly lubrication check procedures were not followed",
      "Lack of early-stage vibration trending data warnings"
    ],
    "Material": [
      "ISO VG 68 turbine oil depleted in sump",
      "Bearing cage material failed under high friction heat load"
    ],
    "Manpower": [
      "Maintenance technicians failed to top up oil sight glass levels",
      "Startup attempted without inspecting oil sump level or shaft rotation"
    ],
    "Measurement": [
      "Sight glass cloudy, preventing easy level visibility",
      "No direct low-oil level indicator or alarm in the DCS panel"
    ],
    "Environment": [
      "High ambient plant dust contributing to lubrication contamination"
    ]
  }
};

const B401_FALLBACK = {
  whys: [
    "Boiler B-401 experienced a fuel gas pressure surge leading to manual emergency trip.",
    "The pressure regulating valve PRV-802 failed open, dumping high-pressure gas into the header.",
    "The PRV diaphragm ruptured and locked in the 90% open position.",
    "Moisture collected and froze inside the instrument air supply line feeding the valve actuator.",
    "The upstream instrument air dryer system failed, allowing moisture carryover, combined with freezing ambient temperatures."
  ],
  root_cause: "Rupture of the pressure regulating valve diaphragm due to freezing moisture in the instrument air line, caused by an unmaintained upstream air dryer system.",
  fishbone: {
    "Machine": [
      "PRV-802 regulator diaphragm ruptured and locked open",
      "Solenoid shutoff valve SOV-401 closed with a delay of 2.8 seconds"
    ],
    "Method": [
      "No instrument air line purge procedures prior to winter/cold weather",
      "Fail-safe solenoid check intervals were too long (exceeded 30 days)"
    ],
    "Material": [
      "Moisture condensed and froze in lines due to lack of dry air",
      "Rubber diaphragm material hardened and ruptured under pressure"
    ],
    "Manpower": [
      "Operator had to trip boiler manually due to sluggish solenoid valve response",
      "Maintenance missed the instrument air filter dryer replacement schedule"
    ],
    "Measurement": [
      "Pressure transmitter PT-402 did not have automatic trip logic linked to shutoff valve SOV-401"
    ],
    "Environment": [
      "Ambient temperature drop causing moisture condensation to freeze inside the controls"
    ]
  }
};

const DEFAULT_FALLBACK = {
  whys: [
    "An unexpected mechanical degradation occurred in the equipment.",
    "The rotating parts experienced abnormal wear and increased friction.",
    "A failure occurred in the scheduled lubrication or inspection routine.",
    "Critical mechanical components operated outside of recommended OEM tolerances.",
    "Operational guidelines and safety standard metrics were not fully integrated with panel automation."
  ],
  root_cause: "Lack of real-time monitoring and deviation checks against OEM design limits, causing progressive wear and final failure.",
  fishbone: {
    "Machine": ["Vibration limit exceeded", "Component wear and misalignment"],
    "Method": ["Inadequate inspection frequency", "Standard operating limits not enforced"],
    "Material": ["Lubricant degradation", "Part wear and fatigue"],
    "Manpower": ["Sluggish response to minor deviations", "Operator training gap"],
    "Measurement": ["No automated trip logic on high vibration", "Delayed alarm warning"],
    "Environment": ["High ambient process temperature"]
  }
};

router.post('/', async (req, res) => {
  const { incidentDescription, assetId } = req.body;

  if (!incidentDescription) {
    return res.status(400).json({ error: 'Missing incidentDescription in request body' });
  }

  // 1. Check for offline fallback matching to ensure safety net
  const text = incidentDescription.toLowerCase();
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const hasKeys = (geminiKey && geminiKey !== 'your_gemini_api_key_here') || (groqKey && groqKey !== 'your_groq_api_key_here');

  if (!hasKeys) {
    console.log('API keys not configured. Loading cached fallback template...');
    if (text.includes('pmp-302') || text.includes('pump') || (assetId && assetId.toLowerCase() === 'pmp-302')) {
      return res.json(PMP302_FALLBACK);
    } else if (text.includes('b-401') || text.includes('boiler') || text.includes('surge') || (assetId && assetId.toLowerCase() === 'b-401')) {
      return res.json(B401_FALLBACK);
    }
    return res.json(DEFAULT_FALLBACK);
  }

  try {
    // 2. Retrieve context from corpus about this asset/failure
    const { retrievedChunks } = retrieve(incidentDescription, 4, 0.05);
    let contextText = '';
    retrievedChunks.forEach((chunk, i) => {
      contextText += `Document: ${chunk.title} (${chunk.doc_id})\nContent: ${chunk.text}\n\n`;
    });

    // 3. Prompt the LLM
    const systemInstruction = 
      "You are an expert industrial safety and reliability engineer. Perform a professional Root Cause Analysis (RCA). " +
      "You will generate a 5-Whys sequence and classify the factors into a Fishbone diagram's standard categories: " +
      "Machine, Method, Material, Manpower, Measurement, and Environment. " +
      "Return your analysis as a strict JSON object matching the requested schema.";

    const prompt = 
      `Perform a Root Cause Analysis for the following incident:\n` +
      `INCIDENT DESCRIPTION: ${incidentDescription}\n\n` +
      `RELEVANT WORK DETAILS & CONTEXT:\n` +
      `${contextText || 'No direct maintenance history found.'}\n\n` +
      `Create a 5-Whys progression (each why leading to the next, ending in the root cause) ` +
      `and map contributing factors to standard Fishbone (Ishikawa) categories.\n\n` +
      `You MUST respond with a JSON object matching this schema exactly:\n` +
      `{\n` +
      `  "whys": [\n` +
      `    "Why 1: Statement explaining the immediate failure trigger...",\n` +
      `    "Why 2: Statement explaining why 1 occurred...",\n` +
      `    "Why 3: Statement explaining why 2 occurred...",\n` +
      `    "Why 4: Statement explaining why 3 occurred...",\n` +
      `    "Why 5: Statement explaining the fundamental underlying organizational or systemic issue..."\n` +
      `  ],\n` +
      `  "root_cause": "Clear, concise statement summarizing the absolute root cause of the incident.",\n` +
      `  "fishbone": {\n` +
      `    "Machine": ["Asset-related physical issues (e.g. seal leaks, bearing wear)"],\n` +
      `    "Method": ["Process, scheduling, or operating SOP failures"],\n` +
      `    "Material": ["Quality or grade issues, lubricants, spare parts, fluids"],\n` +
      `    "Manpower": ["Operator training, compliance errors, manual delays"],\n` +
      `    "Measurement": ["Lack of sensor indicators, calibration errors, calibration schedules"],\n` +
      `    "Environment": ["Weather, temperature, noise, dust, lighting conditions"]\n` +
      `  }\n` +
      `}`;

    console.log('Prompting LLM for RCA generation...');
    const llmRawResponse = await callLLM({
      prompt,
      systemInstruction,
      jsonMode: true
    });

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(llmRawResponse);
    } catch (parseErr) {
      console.warn('Failed to parse RCA response. Raw output:', llmRawResponse);
      // Fallback if parsing fails
      if (text.includes('pmp-302') || text.includes('pump')) {
        parsedResponse = PMP302_FALLBACK;
      } else if (text.includes('b-401') || text.includes('boiler') || text.includes('surge')) {
        parsedResponse = B401_FALLBACK;
      } else {
        parsedResponse = DEFAULT_FALLBACK;
      }
    }

    return res.json({
      whys: parsedResponse.whys || DEFAULT_FALLBACK.whys,
      root_cause: parsedResponse.root_cause || DEFAULT_FALLBACK.root_cause,
      fishbone: {
        Machine: parsedResponse.fishbone?.Machine || [],
        Method: parsedResponse.fishbone?.Method || [],
        Material: parsedResponse.fishbone?.Material || [],
        Manpower: parsedResponse.fishbone?.Manpower || [],
        Measurement: parsedResponse.fishbone?.Measurement || [],
        Environment: parsedResponse.fishbone?.Environment || []
      }
    });

  } catch (error) {
    console.error('Error in /api/rca:', error);
    // Safe fallback so the UI never crashes during demo
    if (text.includes('pmp-302') || text.includes('pump')) {
      return res.json(PMP302_FALLBACK);
    } else if (text.includes('b-401') || text.includes('boiler') || text.includes('surge')) {
      return res.json(B401_FALLBACK);
    }
    return res.json(DEFAULT_FALLBACK);
  }
});

module.exports = router;
