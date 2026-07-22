const express = require('express');
const router = express.Router();
const { callLLM } = require('../lib/llmClient');

// Simulated actual state of the plant for the compliance matrix dashboard
const SIMULATED_PLANT_STATE = {
  lastFirePumpTest: "2026-07-16",        // Last test was 5 days ago (Within 7 days limit - COMPLIANT)
  dieselTankLevel: 88,                  // 88% capacity (Below 90% limit - VIOLATION)
  starterBatteryVoltage: 22.8,          // 22.8V (Below 24V limit - VIOLATION)
  delugeValveTest: "2025-12-14",         // Last tested > 6 months ago (VIOLATION)
  jockeyPumpPressure: 6.8               // 6.8 kg/cm² (Below 7.0 kg/cm² limit - VIOLATION)
};

// Rules mapping definitions
const COMPLIANCE_RULES = [
  {
    id: 'rule_fire_pump_run',
    name: 'Weekly Fire Water Pump Run Test',
    standard: 'OISD-STD-189 Section 6.2',
    parameter: 'lastFirePumpTest',
    check: (val) => {
      const lastDate = new Date(val);
      const currentDate = new Date('2026-07-21'); // Simulated current date of hackathon
      const diffTime = Math.abs(currentDate - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        passed: diffDays <= 7,
        reading: `${diffDays} days ago (${val})`,
        limit: 'Within 7 days (weekly)'
      };
    }
  },
  {
    id: 'rule_diesel_tank_level',
    name: 'Diesel Storage Tank Capacity',
    standard: 'OISD-STD-189 Section 6.2',
    parameter: 'dieselTankLevel',
    check: (val) => {
      return {
        passed: val >= 90,
        reading: `${val}%`,
        limit: 'Minimum 90%'
      };
    }
  },
  {
    id: 'rule_battery_voltage',
    name: 'Starter Battery Voltage',
    standard: 'OISD-STD-189 Section 6.2',
    parameter: 'starterBatteryVoltage',
    check: (val) => {
      return {
        passed: val >= 24.0,
        reading: `${val}V`,
        limit: 'Minimum 24.0V'
      };
    }
  },
  {
    id: 'rule_deluge_valve_actuation',
    name: 'Deluge Valve Actuation Test',
    standard: 'OISD-STD-189 Section 6.3',
    parameter: 'delugeValveTest',
    check: (val) => {
      const lastDate = new Date(val);
      const currentDate = new Date('2026-07-21');
      const diffTime = Math.abs(currentDate - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        passed: diffDays <= 180, // 6 months
        reading: `${Math.round(diffDays / 30)} months ago (${val})`,
        limit: 'Within 6 months (180 days)'
      };
    }
  },
  {
    id: 'rule_jockey_pump_pressure',
    name: 'Fire Water Piping Pressurization',
    standard: 'OISD-STD-189 Section 6.1',
    parameter: 'jockeyPumpPressure',
    check: (val) => {
      return {
        passed: val >= 7.0,
        reading: `${val} kg/cm²`,
        limit: 'Minimum 7.0 kg/cm²'
      };
    }
  }
];

// Offline explanations fallback in case API key is missing or fails
const STATIC_EXPLANATIONS = {
  rule_diesel_tank_level: "Risk: Low diesel reserves can lead to premature shutdown of emergency fire water pumps during prolonged incidents. Action: Immediately top up the fuel tank to 90% capacity and inspect for fuel line leaks.",
  rule_battery_voltage: "Risk: Insufficient starter motor voltage may cause engine cranking failure when starting the backup diesel pump in an emergency. Action: Inspect battery charger system, check electrolyte levels, and replace starter batteries immediately.",
  rule_deluge_valve_actuation: "Risk: Clogged nozzles or dry deluge valve mechanisms may fail to actuate, resulting in inadequate spray coverage on LPG tanks. Action: Schedule immediate actuation test, check nozzles for blockages, and service valve assemblies.",
  rule_jockey_pump_pressure: "Risk: Reduced pressure indicates headers could be dry or have leaks, causing delayed water delivery during fire containment. Action: Inspect jockey pump seals, calibrate pressure controls, and check headers for line leaks."
};

/**
 * Generate risk explanations using the LLM for any rule that failed.
 */
async function generateExplanation(ruleName, standard, reading, limit) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const hasKeys = (geminiKey && geminiKey !== 'your_gemini_api_key_here') || (groqKey && groqKey !== 'your_groq_api_key_here');

  if (!hasKeys) {
    return null;
  }

  const prompt = 
    `You are an industrial safety expert. Explain the hazard risk of this compliance violation and state the immediate correction needed.\n` +
    `Violation Details:\n` +
    `- System: ${ruleName}\n` +
    `- Governing Standard: ${standard}\n` +
    `- Current Reading: ${reading}\n` +
    `- Allowed Limit: ${limit}\n\n` +
    `Respond in exactly 2 concise, action-oriented sentences. Format: "Risk: [Explanation]. Action: [Correction]."`;

  try {
    const rawResult = await callLLM({
      prompt,
      systemInstruction: "You are a professional safety engineer. Keep responses under 40 words and exactly in 2 sentences."
    });
    return rawResult.trim();
  } catch (err) {
    console.error(`Failed compliance explanation generation for ${ruleName}:`, err.message);
    return null;
  }
}

async function runComplianceChecks() {
  const results = [];
  
  for (const rule of COMPLIANCE_RULES) {
    const val = SIMULATED_PLANT_STATE[rule.parameter];
    const checkResult = rule.check(val);
    
    let explanation = "";
    if (!checkResult.passed) {
      // Attempt to generate explanation via LLM
      explanation = await generateExplanation(
        rule.name,
        rule.standard,
        checkResult.reading,
        checkResult.limit
      );
      
      // If LLM failed or key is missing, fall back to static safety definitions
      if (!explanation) {
        explanation = STATIC_EXPLANATIONS[rule.id] || "Risk: Standard safety margin compromised. Action: Inspect and restore normal operating levels.";
      }
    }

    results.push({
      id: rule.id,
      name: rule.name,
      standard: rule.standard,
      passed: checkResult.passed,
      reading: checkResult.reading,
      limit: checkResult.limit,
      explanation: explanation
    });
  }

  return {
    timestamp: "2026-07-21T13:00:00Z",
    plantState: SIMULATED_PLANT_STATE,
    results: results
  };
}

router.get('/', async (req, res) => {
  try {
    const data = await runComplianceChecks();
    return res.json(data);
  } catch (error) {
    console.error('Error in GET /api/compliance:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/resolve', async (req, res) => {
  const { ruleId } = req.body;

  if (!ruleId) {
    return res.status(400).json({ error: 'Missing ruleId in request body.' });
  }

  console.log(`Resolving compliance check rule: ${ruleId}`);

  switch (ruleId) {
    case 'rule_diesel_tank_level':
      SIMULATED_PLANT_STATE.dieselTankLevel = 95; // above 90%
      break;
    case 'rule_battery_voltage':
      SIMULATED_PLANT_STATE.starterBatteryVoltage = 24.3; // above 24V
      break;
    case 'rule_deluge_valve_actuation':
      SIMULATED_PLANT_STATE.delugeValveTest = "2026-07-15"; // within 6 months
      break;
    case 'rule_jockey_pump_pressure':
      SIMULATED_PLANT_STATE.jockeyPumpPressure = 7.2; // above 7.0
      break;
    default:
      return res.status(400).json({ error: `Unknown compliance rule ID: ${ruleId}` });
  }

  try {
    const data = await runComplianceChecks();
    return res.json(data);
  } catch (error) {
    console.error('Error in POST /api/compliance/resolve:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
