-- Seed Data for e-Work Chatbot

-- Insert demo users
INSERT INTO ework_users (mobile_number, name, sso_id, role, user_level, district, block, gram_panchayat, department, agency, status) VALUES
('+919999999999', 'Paras Sharma', 'SSO001', 'District User', 'District', 'Jaipur', 'Sanganer', 'Muralipura', 'Panchayati Raj', 'DRDA', 'Active'),
('+919888888888', 'Rajesh Kumar', 'SSO002', 'Block User', 'Block', 'Jaipur', 'Sanganer', 'Kanota', 'Panchayati Raj', 'Block Office', 'Active'),
('+919777777777', 'Amit Patel', 'SSO003', 'State User', 'State', 'Rajasthan', 'All', 'All', 'Panchayati Raj', 'State', 'Active');

-- Insert sample works
INSERT INTO works (work_id, work_name, scheme_name, financial_year, district, block, gram_panchayat, status, sanctioned_amount, physical_progress) VALUES
('2026-27/3333', 'Construction of Community Hall', 'DDUGJY', '2026-27', 'Jaipur', 'Sanganer', 'Muralipura', 'Work in Progress', 500000, 65),
('2026-27/3334', 'Road Construction from Village to Main Road', 'PMGSY', '2026-27', 'Jaipur', 'Sanganer', 'Kanota', 'Work in Progress', 750000, 40),
('2026-27/3335', 'Anganwadi Building Construction', 'ICD Sectors', '2026-27', 'Jaipur', 'Sanganer', 'Muralipura', 'Proposed', 350000, 0),
('2026-27/3336', 'Water Tank Construction', 'NRDWP', '2026-27', 'Jaipur', 'Sanganer', 'Bhawnagar', 'Completed', 250000, 100),
('2026-27/3337', 'Primary School Building Repair', 'SSA', '2026-27', 'Jaipur', 'Sanganer', 'Muralipura', 'Work in Progress', 180000, 75);

-- Insert sanctions
INSERT INTO sanctions (work_id, type, sanction_number, sanction_date, amount, status)
SELECT w.id, 'Administrative', 'AS/2026/125', '2026-07-15', w.sanctioned_amount, 'Approved'
FROM works w WHERE w.work_id = '2026-27/3333';

INSERT INTO sanctions (work_id, type, sanction_number, sanction_date, amount, status)
SELECT w.id, 'Technical', 'TS/2026/102', '2026-07-18', w.sanctioned_amount * 0.96, 'Approved'
FROM works w WHERE w.work_id = '2026-27/3333';

INSERT INTO sanctions (work_id, type, sanction_number, sanction_date, amount, status)
SELECT w.id, 'Financial', 'FS/2026/085', '2026-07-20', w.sanctioned_amount * 0.96, 'Approved'
FROM works w WHERE w.work_id = '2026-27/3333';

-- Insert measurement books
INSERT INTO measurement_books (work_id, mb_number, mb_type, amount, status)
SELECT w.id, 1, 'Running MB', 125000, 'Approved'
FROM works w WHERE w.work_id = '2026-27/3333';

INSERT INTO measurement_books (work_id, mb_number, mb_type, amount, status)
SELECT w.id, 2, 'Running MB', 150000, 'Approved'
FROM works w WHERE w.work_id = '2026-27/3333';

INSERT INTO measurement_books (work_id, mb_number, mb_type, amount, status)
SELECT w.id, 3, 'Final MB', 175000, 'Pending'
FROM works w WHERE w.work_id = '2026-27/3333';

-- Insert vouchers
INSERT INTO vouchers (work_id, voucher_number, voucher_date, gross_amount, net_amount, status, fto_status)
SELECT w.id, 'VCH-2026-145', '2026-07-22', 125000, 118500, 'Approved', 'Generated'
FROM works w WHERE w.work_id = '2026-27/3333';

INSERT INTO vouchers (work_id, voucher_number, voucher_date, gross_amount, net_amount, status, fto_status)
SELECT w.id, 'VCH-2026-156', '2026-07-28', 150000, 142500, 'Approved', 'Processed'
FROM works w WHERE w.work_id = '2026-27/3333';

-- Insert FTOs
INSERT INTO ftos (voucher_id, fto_number, fto_date, amount, ifms_status, payment_status, utr_number, payment_date)
SELECT v.id, 'FTO-2026-115', '2026-07-24', v.net_amount, 'Processed', 'Successful', 'SBIN2026072500123', '2026-07-25'
FROM vouchers v WHERE v.voucher_number = 'VCH-2026-145';

INSERT INTO ftos (voucher_id, fto_number, fto_date, amount, ifms_status, payment_status)
SELECT v.id, 'FTO-2026-125', '2026-07-30', v.net_amount, 'Processed', 'Successful'
FROM vouchers v WHERE v.voucher_number = 'VCH-2026-156';

-- Insert Utilization Certificate
INSERT INTO utilization_certificates (work_id, uc_number, uc_date, amount, status)
SELECT w.id, 'UC-2026-102', '2026-07-27', 450000, 'Approved'
FROM works w WHERE w.work_id = '2026-27/3333';

-- Insert Completion Certificate
INSERT INTO completion_certificates (work_id, cc_number, cc_date, completion_amount, status)
SELECT w.id, 'CC-2026-075', '2026-07-30', 470000, 'Approved'
FROM works w WHERE w.work_id = '2026-27/3336';

-- Insert Work Photos
INSERT INTO work_photos (work_id, photo_url, work_stage, physical_progress, upload_date)
SELECT w.id, 'https://example.com/photos/work3333.jpg', 'Structure Work', 65, '2026-07-25'
FROM works w WHERE w.work_id = '2026-27/3333';

-- Insert Knowledge Base entries for RAG
INSERT INTO knowledge_base (content, category, source) VALUES
('To forward a voucher in e-Work, first ensure the voucher is approved by the maker. Then login as checker, go to Voucher > Forward, select the voucher, verify details, and click Forward. Make sure all required documents are uploaded and the amount is within available MB amount.', 'voucher', 'user_manual'),
('To generate an FTO (Fund Transfer Order), go to Payment Module > FTO Generation. Select the approved voucher, verify payment details, and click Generate FTO. The FTO will be sent to IFMS for processing.', 'fto', 'user_manual'),
('To approve an estimate, login as Technical Sanction authority. Go to Works > Estimate Approval, select the work, review the technical specifications and cost, and click Approve or Reject with comments.', 'estimate', 'user_manual'),
('Payment may be pending due to: FTO not generated yet, FTO under processing in IFMS, bank details not updated, or payment rejected by IFMS. Check FTO status in Payment module.', 'payment', 'troubleshooting'),
('To generate Utilization Certificate, go to Works > Utilization Certificate. Select the work with completed measurements, verify expenditure details, and click Generate UC.', 'uc', 'user_manual'),
('To create Final Measurement Book, complete all running MBs first. Go to Works > Measurement Book, select Final MB type, enter final measurements, and submit for approval.', 'mb', 'user_manual'),
('To add vendor, go to Admin > Vendor Management, click Add Vendor, fill in details including GST number and bank account details, and save.', 'vendor', 'user_manual'),
('To submit work proposal, go to Works > New Work Proposal, fill in all required details including scheme selection, location, and estimated cost, upload necessary documents, and submit for approval.', 'work_proposal', 'user_manual'),
('Administrative Sanction (AS) is the first level of approval for a work, typically given by the district-level authority. It validates the need and basic cost estimate of the work.', 'sanction', 'glossary'),
('Technical Sanction (TS) is given by Technical Sanctioning Authority to validate the technical specifications, design, and detailed estimate of the work.', 'sanction', 'glossary'),
('Financial Sanction (FS) is the final approval that ensures budget availability for the work. It is usually given after AS and TS are approved.', 'sanction', 'glossary'),
('FTO (Fund Transfer Order) is a document that authorizes the transfer of payment from the government account to the contractor/vendor bank account through IFMS.', 'payment', 'glossary'),
('Utilization Certificate (UC) is a document certifying that the funds utilized for a work have been used for the intended purpose as per guidelines.', 'uc', 'glossary'),
('Completion Certificate (CC) is issued after a work is physically completed and all final payments are made. It certifies the completion of the work as per specifications.', 'completion', 'glossary'),
('Measurement Book (MB) is a document that records all measurements of work done, used for calculating the payment due to the contractor.', 'mb', 'glossary');