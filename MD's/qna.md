# e-Work RAG Chatbot Q&A

## E-Work_Best_Practices

### Question:
"How many works does e-Work currently monitor through its single window monitoring system?"

### Expected Answer:
"Approximately 2.1 lakh (210,000) works are monitored through the single e-Work system."

### Source:
- **Document**: E-Work_Best_Practices_latest__1_.pdf
- **Location**: Final slide (Slide 10-12) - Single Window Monitoring / Dashboard section
- **Extracted chunk**: Chunk 10 (Hindi text: "लगभग 2.1 लाख कार्यों को मॉनिटरिंग एक ही सिस्टम")

---

### Question:
"How does e-Work ensure payments reach the right people without corruption or delay?"

### Expected Answer:
"Payments are transferred directly to the beneficiary/vendor's bank account, with OTP and e-Sign based secure payment authorization at each step to control corruption and delays."

### Source:
- **Document**: E-Work_Best_Practices_latest__1_.pdf
- **Location**: Slide 5 - Payment Security section
- **Extracted chunk**: Chunk 4 (Hindi text mentions OTP and e-Sign for payment authorization)

---

### Question:
"What accountability mechanism does e-Work use across approval levels?"

### Expected Answer:
"A Maker-Checker-Approver system operates at all levels, ensuring accountability and transparency in every transaction."

### Source:
- **Document**: E-Work_Best_Practices_latest__1_.pdf
- **Location**: Slide 5 - Accountability section
- **Extracted chunk**: Chunk 5 (Hindi text: "भुगतान प्रक्रिया (Maker-Checker-Approver)")

---

## e-work_web_newest (eWork 2.0)

### Question:
"What happens once a voucher exceeds 80% of the FS (Financial Sanction) amount?"

### Expected Answer:
"It's automatically routed to the District CEO for additional approval via OTP, before the FTO can be sent for payment."

### Source:
- **Document**: e-work_web_newest__E-_WORK__1_.pdf
- **Location**: Slide 33 (Voucher and Payment Flow)

---

### Question:
"What security measures protect e-Work logins and approvals?"

### Expected Answer:
"Two-factor authentication (application user + SSO user), role-based access (Maker/Checker/Approver), and OTP verification tied to the SSO-registered mobile number for all checks and approvals."

### Source:
- **Document**: e-work_web_newest__E-_WORK__1_.pdf
- **Location**: Slide 4 (Salient features)

---

### Question:
"How is a vendor verified before becoming eligible for payment?"

### Expected Answer:
"Through a 3-stage flow: Maker registers the vendor → Checker verifies → Approver gives final approval via OTP. Only after Approver sign-off is the vendor eligible for payment."

### Source:
- **Document**: e-work_web_newest__E-_WORK__1_.pdf
- **Location**: Slide 26 (Vendor Registration Flow)

---

### Question:
"How can I generate an FTO?"

### Expected Answer:
"FTO (Fund Transfer Order) can only be generated for vouchers that have already been approved. The flow is: Voucher entry (by Maker) → Checker verifies → Approver approves via OTP → Generate FTO → e-Signed by the approver → sent to IFMS/PFMS for payment."

### Source:
- **Document**: e-work_web_newest__E-_WORK__1_.pdf
- **Location**: Slides 33 & 37

---

## mobileApp_MLA_Recommendation

### Question:
"What are the two ways an MLA can submit a work recommendation?"

### Expected Answer:
"Through the e-Work mobile app (via the Recommendation tab, after SSO login) or through the SSO web portal (sso.rajasthan.gov.in), logging in with the e-Work ID/password provided by the department."

### Source:
- **Document**: mobileApp_MLA_Recommendation_PPT__1_.pdf
- **Location**: Slide 2

---

### Question:
"What login credentials does an MLA need for the mobile app?"

### Expected Answer:
"Their SSO ID and password (using their e-Work ID-password) to log into the e-Work mobile app."

### Source:
- **Document**: mobileApp_MLA_Recommendation_PPT__1_.pdf
- **Location**: Slide 2

---

### Question:
"Can an MLA check the status of works they've recommended?"

### Expected Answer:
"Yes — the mobile app also lets them view the status of works they've already recommended, in addition to submitting new ones."

### Source:
- **Document**: mobileApp_MLA_Recommendation_PPT__1_.pdf
- **Location**: Slide 2

---

## Gramin Vikas (ग्रामीण विकास एवं पंचायती राज विभाग)

### Question:
"कार्य निर्माण करते समय कौन-कौन से दस्तावेज़ अपलोड करने अनिवार्य हैं?"

### Expected Answer:
"Layout Upload और Site Image Upload — ये दोनों दस्तावेज़ कार्य निर्माण के दौरान अनिवार्य होते हैं।"

### Source:
- **Document**: ग्रामीण विकास एवं पंचायती राज विभाग (राजस्थान सरकार) [Repaired] (1).pptx / eworkdata.pdf
- **Location**: Slide 9 / Chunk 17 (eworkdata.pdf)

---

### Question:
"भुगतान प्रक्रिया में किस पोर्टल के माध्यम से राशि लाभार्थी के खाते में भेजी जाती है?"

### Expected Answer:
"हस्ताक्षरित FTO को PFMS पोर्टल पर भेजा जाता है, जहाँ से Direct Benefit Transfer (DBT) के माध्यम से राशि सीधे लाभार्थी के बैंक खाते में भेजी जाती है।"

### Source:
- **Document**: eworkdata.pdf
- **Location**: Chunk 31 (mentions PFMS and e-Sign for payment)

---

### Question:
"e-Work सिस्टम में कितने प्रकार की भूमिकाएं (roles) होती हैं और वे क्या करती हैं?"

### Expected Answer:
"तीन भूमिकाएं — निर्माता (Creator: डेटा एंट्री, कार्य/उपयोगकर्ता/दस्तावेज़ अपलोड), परीक्षक (Checker: जानकारी की जांच, सुधार हेतु वापस भेजना या आगे अग्रेषित करना), और अनुमोदक (Approver: अंतिम डिजिटल सत्यापन एवं अनुमोदन)।"

### Source:
- **Document**: eworkdata.pdf
- **Location**: Chunk 14, 24 (Maker/Checker/Approver roles in Hindi)

---

## ework_doc (Functional Requirements)

### Question:
"Voucher forward नहीं हो रहा है।"

### Expected Answer:
"Please verify the following: 1. The voucher is approved by the maker. 2. The checker role is properly mapped. 3. The voucher has not already been forwarded. 4. All mandatory documents are uploaded. 5. The voucher amount is within the available MB amount."

### Source:
- **Document**: ework_doc (data/qa_pairs.json)
- **Location**: Section 3.1

---

### Question:
"What is the Work ID used in the example throughout this document?"

### Expected Answer:
"2026-27/3333 (Construction of Community Hall, Jaipur district)."

### Source:
- **Document**: ework_doc (data/qa_pairs.json)
- **Location**: Sections 7, 9, 10, 23

---

### Question:
"What happens if my mobile number is not registered in e-Work?"

### Expected Answer:
"Your mobile number is not registered in e-Work. Work-related information cannot be displayed. Please contact the e-Work administrator to update your mobile number. You can still use Ask e-Work Chatbot for general questions."

### Source:
- **Document**: ework_doc (data/qa_pairs.json)
- **Location**: Section 6

1. Extract text from all 5 files in uploads/
2. Chunk them (500 chars, 50 overlap)
3. Generate Cohere embeddings
4. Store in Supabase knowledge_base with appropriate categories

npm run chat:rag - for rag chat
npm run chat:sum - for summarized chat and memory retention

/api/whatsapp/flow