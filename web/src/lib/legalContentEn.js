// English translations of the privacy policy and terms (lib/legalContent.js).
// Keep the section ids and order identical to the Thai version; the Thai text governs.
import { CONTACT_EMAIL } from './legalContent';

const CONTROLLER_EN = 'Mr. Burhan Jewjoub, author of the Rice AI project';
const ORG_EN = 'the Computer and Information Science for Management programme, Faculty of Communication Sciences, Prince of Songkla University, Pattani Campus';

export const privacyEn = {
  title: 'Privacy Policy',
  updated: '13 October 2026',
  version: '1.1',
  summary: [
    'We keep your account details, leaf photos, results and location (when you allow it) to diagnose diseases and build the outbreak map.',
    'The public map uses scan results without names or emails, but the photo, disease, time and location of a scan can still be accessed.',
    'We do not sell data, show ads or track you for marketing.',
    'When you send feedback, we store your message and any contact details you provide so the administrator can review it and follow up.',
    `You can ask to see, correct or delete your data at any time at ${CONTACT_EMAIL}.`,
  ],
  sections: [
    {
      id: 'controller',
      heading: 'Data controller',
      blocks: [
        { p: `Rice AI is a student project of ${ORG_EN}. The data controller under Thailand's Personal Data Protection Act B.E. 2562 (2019) is ${CONTROLLER_EN}.` },
        { p: `This policy covers the website rice-ai-appp.web.app, the Rice AI Android app and all related services. Contact us about personal data at ${CONTACT_EMAIL}.` },
      ],
    },
    {
      id: 'collect',
      heading: 'What we collect',
      blocks: [
        {
          table: {
            head: ['Type', 'Data', 'Where it comes from'],
            rows: [
              ['Account', 'Full name, username, email, phone (optional), province or area, role', 'You enter it at sign-up, or it comes from your Google account if you sign in with Google'],
              ['Researcher details', 'Organisation, contact email, purpose of data access', 'The researcher application form'],
              ['Sign-in', 'Password (stored as a one-way hash), 2FA key, last sign-in time', 'Stored by Firebase Authentication; we never see your password'],
              ['Scan results', 'Leaf photo (resized to at most 800 px on the long side), disease, confidence, advice, time', 'Each time you run an analysis'],
              ['Location', 'Latitude, longitude, province and sub-district/district name', "Your phone's GPS, only when you allow it"],
              ['Field notebook', 'Field name, location, area, rice variety, planting date, activities, costs, yield', 'You enter it'],
              ['Notifications', 'Device token for notifications (FCM token), read status', 'Registered by the app when you allow notifications'],
              ['Feedback', 'Category, subject, details, optional name/email, submission page and account ID when signed in', 'The website feedback form'],
              ['Activity log', 'Key actions such as sign-in, adding or editing data and file exports, with time', 'Recorded automatically'],
              ['Settings', 'Theme, text size, language', 'You choose them'],
            ],
          },
        },
        { p: 'We do not collect sensitive data under section 26 of the Act, such as religion, health or biometrics, and we use no behavioural analytics or advertising tools.' },
      ],
    },
    {
      id: 'purpose',
      heading: 'Purposes and legal bases',
      blocks: [
        {
          table: {
            head: ['Purpose', 'Legal basis'],
            rows: [
              ['Create accounts, verify identity and grant role-based access', 'Necessary to provide the service you request (section 24(3))'],
              ['Analyse photos, show advice and keep your history', 'Necessary to provide the service (section 24(3))'],
              ['Record where disease was found', "Your consent, which you can withdraw at any time in your phone's settings (section 19)"],
              ['Build the outbreak map and alert users in at-risk provinces', 'Legitimate interest in plant disease surveillance (section 24(5))'],
              ['Let administrators review AI results and use reviewed photos to improve the model', 'Legitimate interest in improving accuracy (section 24(5))'],
              ['Give researchers de-identified data for research', 'Research and statistics (section 24(1)); names, emails and coordinates are removed first'],
              ['Receive feedback and follow up when you ask us to', 'Your consent before submitting the form (section 19)'],
              ['Prevent misuse and keep an audit trail', 'Legitimate interest in security (section 24(5))'],
            ],
          },
        },
      ],
    },
    {
      id: 'public',
      heading: 'What others can see',
      blocks: [
        { p: 'The outbreak map on the website is open to everyone so farmers can follow the situation in their area. It shows the number of reports per province and district, never users\' names, emails or photos.' },
        { note: 'Please note: the scan records behind the map (leaf photo, disease, confidence, time, coordinates and a random user ID, not a name or email) can still be reached through the system without signing in. Photograph only the leaf, keep faces, house numbers and signs out of frame, and leave location off if you do not want coordinates saved. We are changing the system so the public side sees totals only.' },
      ],
    },
    {
      id: 'share',
      heading: 'Who we share data with',
      blocks: [
        { p: 'We never sell or rent personal data. Data is disclosed only in these cases:' },
        {
          list: [
            "The project's administrators, to manage accounts, review AI results and send outbreak notices",
            'Approved researchers, who see only de-identified data (disease, confidence, province, region, date); every export is logged',
            'Google Firebase (Google LLC), which provides the database, sign-in, notifications and website hosting',
            'OpenStreetMap Foundation (Nominatim and map tiles), which receives coordinates to look up sub-district/district names and to draw field maps',
            'Open-Meteo, which receives coordinates to fetch the local weather forecast',
            "Android's built-in address lookup (Google), when the app shows your area name on the profile screen",
            'Government authorities, when required by law or court order',
          ],
        },
      ],
    },
    {
      id: 'transfer',
      heading: 'International transfers',
      blocks: [
        { p: "The main database is in Google's data centre in Singapore (asia-southeast1). Sign-in data and some Google services may be processed in other countries. These providers protect data under contract and international standards, in line with sections 28 and 29 of the Act." },
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep data',
      blocks: [
        {
          list: [
            'Account data, scan results and field notebooks are kept while your account is active or until the project ends',
            'When you ask us to delete your account, we delete your account data and identifiable scan results within 30 days',
            'Security logs are kept for no more than one year',
            'Feedback is kept while it is being reviewed and handled; you may request deletion by contacting the project email',
            'De-identified data and aggregate statistics may be kept for study, as they cannot identify anyone',
          ],
        },
      ],
    },
    {
      id: 'security',
      heading: 'Security',
      blocks: [
        {
          list: [
            'All traffic is encrypted with HTTPS/TLS',
            'Passwords are stored as one-way hashes by Firebase Authentication, and two-step verification (TOTP) is supported',
            'Database security rules limit reading and writing by role; for example, a field notebook is visible only to its owner',
            'The server verifies the user before accepting any photo for analysis',
            'Administrator actions and data exports are logged for later review',
          ],
        },
        { p: 'If a data breach puts your rights at risk, we will notify the Personal Data Protection Committee within 72 hours and inform those affected without delay.' },
      ],
    },
    {
      id: 'rights',
      heading: 'Your rights',
      blocks: [
        { p: 'Under the Personal Data Protection Act you have the right to:' },
        {
          list: [
            'Access your data and get a copy',
            'Have inaccurate or outdated data corrected (you can edit your profile yourself in the app and website)',
            'Have your data deleted or de-identified',
            'Have the use of your data temporarily restricted',
            'Object to processing based on legitimate interest',
            'Receive your data in a machine-readable format',
            "Withdraw consent, for example by turning off location or notifications in your phone's settings",
            'Complain to the Office of the Personal Data Protection Committee (PDPC)',
          ],
        },
        { p: `Send requests to ${CONTACT_EMAIL} from the email address you registered with. We reply within 30 days, free of charge.` },
      ],
    },
    {
      id: 'storage',
      heading: 'Cookies and local storage',
      blocks: [
        { p: 'The website and app use no advertising or cross-site tracking cookies. Only what is needed is stored on your device: your sign-in state, theme, text size and language, and data waiting to sync when you are offline. Sign out or clear your browser or app data to remove it.' },
      ],
    },
    {
      id: 'minors',
      heading: 'Minors',
      blocks: [
        { p: 'The service is designed for farmers, researchers and officers. Anyone under 20 should have a parent or guardian\'s consent before signing up. If we find data from a child under 10 without consent, we will delete it.' },
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      blocks: [
        { p: 'When we change this policy we update the date above and announce significant changes on the website or in the app at least 7 days before they take effect.' },
      ],
    },
  ],
};

export const termsEn = {
  title: 'Terms of Service',
  updated: '11 October 2026',
  version: '1.0',
  summary: [
    'AI results are a first-pass aid, not an expert diagnosis. Consult an agricultural officer before using chemicals.',
    'Rice AI is a student project and the mobile app is in beta. The service may pause or change.',
    'Use your own account, upload only rice-leaf photos, and never try to identify people from research data.',
    'The service is free.',
  ],
  sections: [
    {
      id: 'accept',
      heading: 'Accepting these terms',
      blocks: [
        { p: 'These terms apply to the website rice-ai-appp.web.app, the Rice AI app and related services (together, the "Service"). By signing up for or using the Service you confirm that you have read and accept these terms and the Privacy Policy. If you do not accept them, please stop using the Service.' },
      ],
    },
    {
      id: 'service',
      heading: 'About the Service',
      blocks: [
        { p: `Rice AI is a student project of ${ORG_EN}. It classifies four kinds of rice leaf from photos (rice blast, bacterial leaf blight, rice tungro and healthy) and offers management advice, an outbreak map, a rice disease library, and tools for researchers and administrators.` },
        { p: 'The Android app is a beta release. It may contain bugs, features may change, and test data may be cleared at a major release, with notice in advance.' },
      ],
    },
    {
      id: 'account',
      heading: 'Your account',
      blocks: [
        {
          list: [
            'Give true, current information and use only your own account',
            'Keep your password and two-step verification device safe; you are responsible for actions taken through your account',
            'Researcher accounts need administrator approval, and administrators may require two-step verification',
            `Tell us immediately at ${CONTACT_EMAIL} if you think someone else is using your account`,
          ],
        },
      ],
    },
    {
      id: 'ai',
      heading: 'AI results',
      blocks: [
        { note: 'AI results support a first decision only. They are not a diagnosis by a researcher or an agricultural extension officer.' },
        {
          list: [
            'The 96.9% accuracy was measured on a set of 761 test images; photos from real Thai fields may give different results',
            'The system recognises only four classes. If a leaf has another disease, it may still answer with one of these four; photos the AI is less than 75% sure about are rejected and you are asked to retake them',
            "Before using any chemical, confirm the symptoms with your local agricultural officer and follow the label and the Department of Agriculture's guidance exactly",
            "Disease information and advice come from the Rice Department's Rice Knowledge Bank and may be revised",
          ],
        },
      ],
    },
    {
      id: 'acceptable',
      heading: 'What you must not do',
      blocks: [
        {
          list: [
            'Upload images that are not rice leaves, pictures of people, or content that is illegal, infringes others\' rights or is inappropriate',
            'Submit fake scans or deliberately distort outbreak data',
            'Try to access other people\'s data or accounts, bypass sign-in, or probe for vulnerabilities without permission',
            'Send automated bulk requests, scrape the system, or put unusual load on it',
            'Modify, reverse-engineer or distribute altered versions of the app under the Rice AI name',
            'Try to identify individuals from de-identified research data',
          ],
        },
      ],
    },
    {
      id: 'content',
      heading: 'Photos and data you submit',
      blocks: [
        { p: 'Your photos and data remain yours. You allow the project to use them free of charge to provide the Service, build outbreak maps and statistics, review results and train future versions of the AI model, as described in the Privacy Policy. You can ask for them to be deleted through the channels set out there.' },
      ],
    },
    {
      id: 'research',
      heading: 'Using data for research',
      blocks: [
        {
          list: [
            'Researchers may use exported data only for research and for planning plant disease management',
            'Do not sell or redistribute raw data, or combine it with other data to identify farmers',
            'When publishing, cite the source as "Rice AI system, Prince of Songkla University, Pattani Campus"',
            'Every export is logged, and administrators may suspend access if data is misused',
          ],
        },
      ],
    },
    {
      id: 'ip',
      heading: 'Intellectual property',
      blocks: [
        { p: 'The Rice AI name, logo, the Khao Hom character, the design, the software and the AI model are the work of the project author. Disease information is from the Rice Department, and the model was trained on the Paddy Doctor dataset (Petchiammal et al., 2023); these belong to their respective owners.' },
      ],
    },
    {
      id: 'availability',
      heading: 'Availability',
      blocks: [
        { p: 'The Service is provided "as is". We try to keep it running but do not guarantee it will be uninterrupted or error-free. We may improve, suspend or end all or part of the Service, giving reasonable notice when we can.' },
      ],
    },
    {
      id: 'liability',
      heading: 'Limitation of liability',
      blocks: [
        { p: 'To the extent the law allows, the author and the university are not liable for crop losses, chemical costs or other damage caused by decisions based solely on AI results, or by the Service being unavailable. This does not exclude liability that the law does not allow to be excluded.' },
      ],
    },
    {
      id: 'termination',
      heading: 'Suspending and closing accounts',
      blocks: [
        { p: `You can stop using the Service at any time and ask for your account to be deleted at ${CONTACT_EMAIL}. Administrators may suspend or close accounts that break these terms, submit false information or harm the system or other users, and will explain why where possible.` },
      ],
    },
    {
      id: 'law',
      heading: 'Governing law',
      blocks: [
        { p: 'These terms are governed by Thai law. Disputes should first be settled by discussion; if that fails, the Thai courts have jurisdiction.' },
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to these terms',
      blocks: [
        { p: 'We may update these terms from time to time, changing the date above and announcing significant changes at least 7 days in advance. Continuing to use the Service after that date means you accept the updated terms.' },
      ],
    },
  ],
};
