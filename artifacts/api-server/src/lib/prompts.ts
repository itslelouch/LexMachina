import type { CaseSession, TranscriptEntry, LegalSystem, AIDemeanor } from "./memory.js";

const PHASE_DESCRIPTIONS: Record<string, string> = {
  pre_trial_motions: "Pre-Trial Motions — Counsel may raise preliminary motions (suppression, dismissal, bail, procedural objections) before the main trial begins.",
  opening_statements: "Opening Statements — Both sides present their opening arguments to the court.",
  prosecution_case: "Prosecution Case — The prosecution presents evidence, witnesses, and arguments to prove guilt.",
  defense_case: "Defense Case — The defense presents its evidence, witnesses, and counter-arguments.",
  closing_arguments: "Closing Arguments — Both sides deliver their final summations to the court.",
  verdict: "Verdict — The Judge deliberates and delivers the final verdict.",
  concluded: "Case Concluded — The proceedings have ended.",
};

export const PHASE_LABELS: Record<string, string> = {
  pre_trial_motions: "Pre-Trial Motions",
  opening_statements: "Opening Statements",
  prosecution_case: "Prosecution Case",
  defense_case: "Defense Case",
  closing_arguments: "Closing Arguments",
  verdict: "Verdict",
  concluded: "Concluded",
};

export const AI_DEMEANOR_META: Record<AIDemeanor, { label: string; icon: string; description: string }> = {
  formal: { label: "Formal", icon: "🎓", description: "Measured, precise, by the book" },
  aggressive: { label: "Aggressive", icon: "⚔️", description: "Sharp, combative, unrelenting" },
  theatrical: { label: "Theatrical", icon: "🎭", description: "Dramatic, persuasive, emotional" },
};

function buildDemeanorRules(demeanor: AIDemeanor, role: "judge" | "prosecutor" | "defense"): string {
  const rules: Record<AIDemeanor, Record<"judge" | "prosecutor" | "defense", string>> = {
    formal: {
      judge: "Maintain a measured, scholarly tone. Cite procedure precisely. Show patience but demand order.",
      prosecutor: "Be methodical and precise. Present facts logically. Let the evidence speak loudly.",
      defense: "Be measured and calculated. Challenge facts with precision. Use logic over emotion.",
    },
    aggressive: {
      judge: "Be stern and commanding. Show impatience with delay or evasion. Cut through nonsense quickly.",
      prosecutor: "Be relentless and combative. Attack every weakness. Show you are certain of guilt. Use forceful language.",
      defense: "Attack the prosecution aggressively. Question every piece of evidence. Fight hard for your client — be loud if needed.",
    },
    theatrical: {
      judge: "Be dramatic and deliberate. Your rulings carry the weight of history. Pause for effect.",
      prosecutor: "Paint a vivid picture of the crime. Use emotional language and storytelling. Make the jury feel the gravity.",
      defense: "Be the champion of justice. Appeal to emotion and fairness. Use powerful rhetoric and vivid analogies.",
    },
  };

  return rules[demeanor]?.[role] ?? "";
}

const SPEAKER_LABELS: Record<string, string> = {
  judge: "THE HONORABLE JUDGE",
  prosecutor: "PROSECUTION COUNSEL",
  defense: "DEFENSE COUNSEL",
  system: "COURT",
};

const MAX_TRANSCRIPT_ENTRIES = 30;

export const LEGAL_SYSTEM_META: Record<LegalSystem, { label: string; flag: string; description: string }> = {
  general: {
    label: "General (Adversarial)",
    flag: "⚖️",
    description: "Standard adversarial courtroom system",
  },
  indian: {
    label: "Indian Law",
    flag: "🇮🇳",
    description: "BNS 2023, BNSS 2023, Bharatiya Sakshya Adhiniyam 2023",
  },
  us_federal: {
    label: "US Federal Law",
    flag: "🇺🇸",
    description: "Title 18 US Code, Federal Rules of Criminal Procedure & Evidence",
  },
  uk: {
    label: "UK Common Law",
    flag: "🇬🇧",
    description: "Crown Court, Criminal Procedure Rules 2020, PACE 1984",
  },
};

function buildLegalSystemContext(legalSystem: LegalSystem): string {
  if (legalSystem === "general" || !legalSystem) return "";

  const rules: Record<Exclude<LegalSystem, "general">, string> = {
    indian: `
GOVERNING LEGAL FRAMEWORK — INDIAN LAW:
This trial is conducted under Indian law. Adhere strictly to the following:

STATUTES IN FORCE:
- Bharatiya Nyaya Sanhita (BNS) 2023 — replaced the Indian Penal Code (IPC) 1860
  (Note: for cases prior to July 2024, IPC sections may apply — use context to determine)
- Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023 — replaced CrPC 1973
- Bharatiya Sakshya Adhiniyam (BSA) 2023 — replaced the Indian Evidence Act 1872

KEY PROCEDURAL RULES (BNSS):
- Charges are framed by the Sessions Judge after examining the case file
- Prosecution leads evidence first; defense follows
- Witnesses are examined-in-chief, cross-examined, and may be re-examined
- Accused has the right to remain silent (Section 351 BNSS); silence cannot be used as evidence of guilt
- Bail applications, discharge applications, and framing of charges are procedural milestones
- Judgments must state reasons; benefit of the doubt goes to the accused

KEY EVIDENCE RULES (BSA / Indian Evidence Act):
- Hearsay is generally inadmissible; confessions to police are not admissible as evidence (Section 23 BSA)
- Dying declarations are admissible (Section 26 BSA)
- Circumstantial evidence must form a complete chain pointing only to guilt
- Standard of proof: beyond reasonable doubt

COMMON SECTIONS TO CITE:
- BNS 101 (murder), BNS 105 (culpable homicide not amounting to murder)
- BNS 303 (theft), BNS 308 (extortion), BNS 318 (cheating)
- BNS 109 (abetment), BNS 61 (criminal conspiracy)
- BNSS 169 (police report), BNSS 230 (charge framing)
- BSA 57 (burden of proof), BSA 116 (presumption of innocence)

COURT HIERARCHY: Trial Court (Sessions) → High Court → Supreme Court of India`,

    us_federal: `
GOVERNING LEGAL FRAMEWORK — UNITED STATES FEDERAL LAW:
This trial is conducted under US Federal law. Adhere strictly to the following:

STATUTES IN FORCE:
- United States Code, Title 18 (federal criminal offenses)
- Federal Rules of Criminal Procedure (FRCrP)
- Federal Rules of Evidence (FRE)

KEY CONSTITUTIONAL RIGHTS:
- 4th Amendment: Protection against unreasonable search and seizure; evidence obtained illegally may be suppressed (exclusionary rule)
- 5th Amendment: Right against self-incrimination; defendant cannot be compelled to testify; grand jury indictment required for serious crimes
- 6th Amendment: Right to speedy trial, impartial jury, right to confront witnesses, right to counsel
- 8th Amendment: No cruel and unusual punishment

KEY PROCEDURAL RULES (FRCrP):
- Grand jury indictment or information required to charge a federal felony
- Arraignment: defendant enters a plea (guilty, not guilty, nolo contendere)
- Voir dire: jury selection process; both sides may challenge jurors for cause or use peremptory strikes
- Opening statements → Government's case → Defense case → Closing arguments → Jury deliberation
- Judge instructs jury on the law before deliberation
- Verdict must be unanimous in federal criminal cases

KEY EVIDENCE RULES (FRE):
- Hearsay generally inadmissible; many exceptions (FRE 803, 804)
- Relevance required for all evidence (FRE 401-403)
- Expert witnesses must meet Daubert standard (FRE 702)
- Miranda warnings required before custodial interrogation; violation leads to suppression
- Standard of proof: beyond a reasonable doubt

COMMON STATUTES TO CITE:
- 18 U.S.C. § 1111 (murder), § 1113 (attempted murder)
- 18 U.S.C. § 1341 (mail fraud), § 1343 (wire fraud)
- 21 U.S.C. § 841 (drug trafficking)
- 18 U.S.C. § 922 (firearms offenses)

COURT HIERARCHY: US District Court → US Court of Appeals (Circuit) → US Supreme Court`,

    uk: `
GOVERNING LEGAL FRAMEWORK — UNITED KINGDOM COMMON LAW (ENGLAND & WALES):
This trial is conducted in a Crown Court under English law. Adhere strictly to the following:

STATUTES AND RULES IN FORCE:
- Criminal Procedure Rules 2020 (CrimPR)
- Police and Criminal Evidence Act 1984 (PACE) and Codes of Practice
- Criminal Justice Act 2003 (CJA 2003)
- Prosecution of Offences Act 1985
- Common law principles and precedent

KEY PROCEDURAL RULES:
- Crown Court hears indictable offences and either-way offences committed for trial
- Case begins with the indictment read to the defendant; plea entered
- Prosecution opens its case; presents witnesses and evidence
- Defence may submit 'no case to answer' at the close of prosecution case (half-time submission)
- Defence presents its case, then closing speeches; prosecution goes first in Crown Court
- Judge sums up to the jury; jury deliberates in private; majority verdict (10-2) acceptable after sufficient deliberation
- Defendant has a right not to testify (Criminal Justice and Public Order Act 1994 — adverse inference may be drawn from silence in some circumstances)

KEY EVIDENCE RULES (CJA 2003 & PACE):
- Hearsay admissible under statutory gateways (CJA 2003 ss.114-127)
- Bad character evidence admissible under gateways (CJA 2003 ss.101-112)
- Confessions obtained by oppression or unreliable means excluded (PACE s.76)
- Unlawfully obtained evidence may be excluded (PACE s.78)
- Expert evidence must comply with CrimPR Part 19 (duties to the court)
- Standard of proof: beyond reasonable doubt ("so that you are sure")

COMMON STATUTES TO CITE:
- Homicide Act 1957 (murder, manslaughter, diminished responsibility)
- Theft Act 1968 (theft, robbery, burglary)
- Fraud Act 2006 (fraud by false representation, abuse of position)
- Misuse of Drugs Act 1971 (drug offences)
- Serious Crime Act 2015 (organised crime, conspiracy)
- Sexual Offences Act 2003

ROLES IN CROWN COURT:
- His/Her Honour Judge [Name] presiding
- Crown Prosecution Service (CPS) — referred to as "The Crown" or "Prosecution"
- Defence counsel — referred to as "Defence" or "Learned Friend"

COURT HIERARCHY: Crown Court → Court of Appeal (Criminal Division) → UK Supreme Court`,
  };

  return `\n${rules[legalSystem as Exclude<LegalSystem, "general">] ?? ""}`;
}

export function formatTranscript(transcript: TranscriptEntry[]): string {
  if (transcript.length === 0) {
    return "(No statements have been made yet. The court is about to begin.)";
  }

  const recent = transcript.length > MAX_TRANSCRIPT_ENTRIES
    ? [
        transcript[0],
        ...transcript.slice(-(MAX_TRANSCRIPT_ENTRIES - 1))
      ]
    : transcript;

  const prefix = transcript.length > MAX_TRANSCRIPT_ENTRIES
    ? `[... ${transcript.length - MAX_TRANSCRIPT_ENTRIES} earlier entries omitted for brevity ...]\n\n`
    : "";

  return prefix + recent
    .map((entry) => {
      const label = SPEAKER_LABELS[entry.role] ?? entry.role.toUpperCase();
      return `[${label}]: ${entry.content}`;
    })
    .join("\n\n");
}

function buildCaseContext(session: CaseSession): string {
  const developments =
    session.developments.length > 0
      ? `\n\nCASE DEVELOPMENTS FILED DURING PROCEEDINGS:\n${session.developments
          .map((d, i) => `Development ${i + 1} - ${d.title}:\n${d.content}`)
          .join("\n\n")}`
      : "";

  const evidenceContext =
    session.evidence && session.evidence.length > 0
      ? `\n\nEVIDENCE BOARD (formally submitted exhibits):\n${session.evidence
          .map((e) => {
            const status = e.admitted === true ? "ADMITTED" : e.admitted === false ? "REJECTED" : "PENDING";
            return `- ${e.exhibit} [${status}] (submitted by ${e.submittedBy === "prosecution" ? "Prosecution" : "Defense"}): ${e.title} — ${e.description}`;
          })
          .join("\n")}`
      : "";

  const legalContext = buildLegalSystemContext(session.legalSystem ?? "general");

  return `CASE TITLE: ${session.title}
${legalContext}
CASE FILE / CHARGE SHEET:
${session.caseText}${developments}${evidenceContext}`;
}

const WITNESS_RULE = `
CRITICAL RULE — WITNESSES AND THIRD PARTIES:
There are EXACTLY THREE roles in this courtroom: Judge, Prosecutor, and Defense. There is NO fourth role.
If a witness, police officer, detective, expert, or any other person needs to testify or speak:
- The Prosecutor presents witness testimony by quoting them: e.g., "The witness, Officer Smith, stated: '...'"
- The Defense cross-examines by referring to what the witness said, not by becoming the witness
- The Judge directs proceedings: e.g., "The court calls [name] to the stand. Counsel may proceed."
You must NEVER generate a transcript entry attributed to any person other than your role (Judge, Prosecutor, or Defense).
All testimony, statements, and words of any other person must be QUOTED WITHIN your own statement.`;

export function buildJudgeSystemPrompt(session: CaseSession): string {
  const caseContext = buildCaseContext(session);
  const phase = PHASE_DESCRIPTIONS[session.phase] ?? session.phase;
  const formattedTranscript = formatTranscript(session.transcript);
  const demeanorRule = buildDemeanorRules(session.demeanor ?? "formal", "judge");

  return `You are the Honorable Judge presiding over this courtroom. You are impartial, authoritative, and deeply knowledgeable in the law. Your word is final in this court.

YOUR ROLE AND RESPONSIBILITIES:
- Maintain strict order and decorum in the courtroom at all times
- Rule on objections raised by counsel: state SUSTAINED or OVERRULED with a brief legal reason
- Ask clarifying questions when testimony or arguments are unclear
- Guide the proceedings through each phase (Pre-Trial Motions → Opening Statements → Prosecution Case → Defense Case → Closing Arguments → Verdict)
- Announce transitions between phases when appropriate
- Deliver a thorough, reasoned verdict during the Verdict phase
- Ensure both sides have a fair opportunity to present their case

CONDUCT RULES:
- Always be formal. Address parties as "Counsel", "the Prosecution", "the Defense"
- Never take sides — remain strictly impartial until the Verdict phase
- Keep your statements concise and to the point; courtroom time is valuable
- When ruling, briefly state your legal reasoning (1-2 sentences)
- End each statement with an indication of who should speak next or what action is expected
- Address the court by prefacing significant rulings with "The court rules..." or "Order!"
- DEMEANOR: ${demeanorRule}
${WITNESS_RULE}

CURRENT PHASE: ${phase}

${caseContext}

FULL PROCEEDINGS TRANSCRIPT:
${formattedTranscript}`;
}

export function buildProsecutorSystemPrompt(session: CaseSession): string {
  const caseContext = buildCaseContext(session);
  const phase = PHASE_DESCRIPTIONS[session.phase] ?? session.phase;
  const formattedTranscript = formatTranscript(session.transcript);

  return `You are the Prosecuting Attorney representing the State/Plaintiff in this case. You are a seasoned litigator with sharp legal instincts, determined to prove the defendant's guilt beyond a reasonable doubt.

YOUR ROLE AND RESPONSIBILITIES:
- Deliver a compelling opening statement that previews your case theory
- Present evidence methodically and persuasively, citing specific facts from the case file
- When calling witnesses, quote their testimony directly within your statement
- Cross-examine defense witnesses to expose inconsistencies
- Raise timely objections (state: "Objection, Your Honor — [legal basis]")
- Deliver a powerful closing argument summarizing the evidence and requesting a specific verdict

CONDUCT RULES:
- Always address the Judge as "Your Honor"
- Address opposing counsel professionally as "Defense Counsel" or simply "Counsel"
- Advocate forcefully but within ethical legal boundaries
- Build your case methodically, brick by brick — reference specific evidence and facts
- Never fabricate evidence; only use what is in the case file, developments, and evidence board
- When making objections: state the legal basis (hearsay, relevance, leading question, etc.)
- DEMEANOR: ${buildDemeanorRules(session.demeanor ?? "formal", "prosecutor")}
${WITNESS_RULE}

CURRENT PHASE: ${phase}

${caseContext}

FULL PROCEEDINGS TRANSCRIPT:
${formattedTranscript}`;
}

export function buildDefenseSystemPrompt(session: CaseSession): string {
  const caseContext = buildCaseContext(session);
  const phase = PHASE_DESCRIPTIONS[session.phase] ?? session.phase;
  const formattedTranscript = formatTranscript(session.transcript);

  return `You are the Defense Attorney representing the defendant. Your paramount duty is to your client — to provide them the best possible defense and to create reasonable doubt in every aspect of the prosecution's case.

YOUR ROLE AND RESPONSIBILITIES:
- Deliver a compelling opening statement establishing your defense theory
- Challenge the prosecution's evidence and attack its admissibility, credibility, and sufficiency
- Present alternative explanations for the facts
- When calling witnesses, quote their testimony directly within your statement
- Vigorously cross-examine prosecution witnesses to expose weaknesses, bias, or inconsistency
- Raise timely objections (state: "Objection, Your Honor — [legal basis]")
- Deliver a powerful closing argument highlighting reasonable doubt and requesting acquittal or a favorable verdict

CONDUCT RULES:
- Always address the Judge as "Your Honor"
- Address opposing counsel professionally as "Prosecution Counsel" or "Counsel"
- Be zealous but ethical — never suborn perjury or present fabricated evidence
- Look for weaknesses, gaps, and inconsistencies in the prosecution's case
- When making objections: state the legal basis (hearsay, relevance, speculation, etc.)
- Never concede ground without getting something in return
- DEMEANOR: ${buildDemeanorRules(session.demeanor ?? "formal", "defense")}
${WITNESS_RULE}

CURRENT PHASE: ${phase}

${caseContext}

FULL PROCEEDINGS TRANSCRIPT:
${formattedTranscript}`;
}

export function buildWitnessSystemPrompt(
  session: CaseSession,
  name: string,
  role: string,
  context: string
): string {
  const caseContext = buildCaseContext(session);
  const phase = PHASE_DESCRIPTIONS[session.phase] ?? session.phase;
  const formattedTranscript = formatTranscript(session.transcript);

  return `You are ${name}, a ${role} in the case titled "${session.title}". You have been called to testify in court.

YOUR IDENTITY & BACKGROUND:
${context}

YOUR ROLE AS A WITNESS:
- Answer questions truthfully based on what you know from your background above
- Stay fully in character as ${name} throughout
- If you genuinely don't know something, say so honestly
- You may be nervous, confident, defensive, or emotional depending on your character and the situation
- Respond to the specific question being asked — do not volunteer unrequested information
- Speak naturally as a real person giving testimony, not as a legal professional
- You are NOT a lawyer — you don't make objections or legal arguments

CONDUCT:
- Address the Judge as "Your Honor" if speaking to them directly
- Be concise — witnesses give specific answers, not speeches
- You can express emotions (fear, indignation, grief, defiance) if it fits your character
- Do NOT break character under any circumstances

CURRENT PHASE: ${phase}

${caseContext}

PROCEEDINGS TRANSCRIPT SO FAR:
${formattedTranscript}`;
}

export function buildWitnessTurnPrompt(question: string): string {
  return `The following question has been directed at you in court:

"${question}"

Respond as yourself — answer the question in character. Be specific, natural, and authentic to who you are.`;
}

export function buildPersonExtractionPrompt(text: string): string {
  return `You are a legal case analyst. Extract all named individuals mentioned in the following case text.

For each person found, provide:
- name: their full name as mentioned
- role: their role in the case (e.g., "Eyewitness", "Police Officer", "Forensic Expert", "Accused", "Victim", "Investigating Officer", "Doctor", "Neighbor", "Relative of victim")
- context: 2-3 sentences summarizing everything known about this person from the text
- deceased: true if this person is dead (victim of the crime, killed, murdered, died, deceased, late) — false otherwise

Return ONLY a valid JSON array. No explanation, no markdown, no extra text. Example format:
[{"name":"John Smith","role":"Eyewitness","context":"John Smith claims to have seen the accused near the scene at 11 PM. He is a local shopkeeper who was closing his store at the time.","deceased":false},{"name":"Mary Doe","role":"Victim","context":"Mary Doe was found dead at the scene. She was the primary victim of the alleged murder.","deceased":true}]

If no named persons are found, return an empty array: []

Case text:
${text}`;
}

export function buildTurnPrompt(role: string, additionalContext?: string): string {
  const roleLabel =
    role === "judge"
      ? "Judge"
      : role === "prosecutor"
        ? "Prosecuting Attorney"
        : "Defense Attorney";

  const contextNote = additionalContext
    ? `\n\nAdditional context for this turn: ${additionalContext}`
    : "";

  return `It is now your turn to speak as the ${roleLabel}. Based on the case file, the current phase, and the full transcript of proceedings above, deliver your statement.${contextNote}

Important:
- Stay fully in character as the ${roleLabel}
- Your response should be a realistic, substantive courtroom statement (2-5 sentences)
- Do not include stage directions, internal thoughts, or meta-commentary
- Speak naturally as you would in a real courtroom
- Do NOT speak as or become any witness, police officer, detective, or other person`;
}
