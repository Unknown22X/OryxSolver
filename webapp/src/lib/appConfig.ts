import { supabase } from './supabase';
import { applyServiceHealthError, markSuccess } from './serviceHealth';

export type ConfigKey = 
  | 'legal_versions'
  | 'product_features'
  | 'terms_content'
  | 'privacy_content'
  | 'terms_content_ar'
  | 'privacy_content_ar'
  | 'enabled_models'
  | 'maintenance_mode'
  | 'announcement_banner'
  | 'support_contact'
  | 'system_limits'
  | 'admin_metrics_cache'
  | 'service_health_snapshot';

export interface LegalVersions {
  terms_version: string;
  privacy_version: string;
  effective_date: string;
}

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDocument {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export interface ProductFeature {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
}

export interface AnnouncementBanner {
  type: 'info' | 'warning' | 'success' | 'promo';
  active: boolean;
  message: string;
  link?: string;
}

export interface PublicAppConfig {
  legalVersions: LegalVersions;
  terms: LegalDocument;
  privacy: LegalDocument;
  features: ProductFeature[];
  maintenance_mode: boolean;
  announcement?: AnnouncementBanner;
  support: {
    email: string;
  };
}

const DEFAULT_SUPPORT_EMAIL = 'support@oryxsolver.com';

const FALLBACK_LEGAL_VERSIONS: LegalVersions = {
  terms_version: '2.1.0',
  privacy_version: '2.1.0',
  effective_date: '2026-04-06',
};

const FALLBACK_TERMS: LegalDocument = {
  title: 'Terms of Use',
  intro: 'By accessing or using the OryxSolver application ("the Service"), operated by OryxSolver (the "Company", "we", "us", or "our"), you agree to be bound by these Terms of Use ("Terms"). These Terms apply to all visitors, users, and others who access or use the Service. Use of the Service is also governed by our Privacy Policy. Nothing in these Terms affects mandatory rights under applicable consumer protection laws. These Terms are governed by the laws of the jurisdiction in which the Company is established. Any disputes shall be subject to the exclusive jurisdiction of the courts in that jurisdiction.',
  sections: [
    {
      heading: '1. Acceptance of Terms',
      body: 'These Terms of Use ("Terms") govern your access to and use of OryxSolver across the web application, browser extension, and related services. By creating an account or using the Service, you signify your acceptance of these Terms and our Privacy Policy.',
    },
    {
      heading: '2. Service Description',
      body: 'OryxSolver is an AI-powered educational software-as-a-service (SaaS) platform that allows users to upload questions (text, images, or PDFs) and receive AI-generated answers, explanations, and study assistance. The Service is provided as digital software only.',
    },
    {
      heading: '3. Eligibility and Age Requirement',
      body: 'You must be at least 13 years of age to use the Service. If you are under 18, you must have the consent of a parent or legal guardian to use the Service. By using the Service, you represent and warrant that you meet these eligibility requirements.',
    },
    {
      heading: '4. AI Disclaimer and Liability',
      body: 'The Service is positioned as a study aid and educational assistant. AI-generated outputs may be inaccurate, incomplete, or misleading. You acknowledge that responses are produced by automated systems which may occasionally produce results that require human review. While we strive for high quality, we do not guarantee that all outputs will be entirely accurate or complete at all times. You are responsible for independently verifying outputs before relying on them for critical decisions.',
    },
    {
      heading: '5. Academic Integrity',
      body: 'OryxSolver is designed to help you understand complex topics and improve your study efficiency. It is not intended to facilitate academic dishonesty. You are solely responsible for ensuring that your use of the Service complies with the rules and policies of your educational institution.',
    },
    {
      heading: '6. User Content and Processing',
      body: 'You retain all ownership rights to the content you upload to the Service (text, images, or PDFs). User content may be transmitted to and processed by third-party AI providers to generate responses. These providers act as data processors on our behalf and may temporarily process data in accordance with their own privacy policies.',
    },
    {
      heading: '7. Prohibited Use',
      body: 'You may not use the Service for any illegal purpose, attempt to interfere with the security of the Service, or share your account credentials with others. Sharing your account credentials with others is strictly prohibited and may lead to a permanent ban of your account.',
    },
    {
      heading: '8. Subscriptions and Refund Policy',
      body: 'You can manage your subscription and cancel your plan at any time through the Service. Subscriptions may auto-renew unless cancelled. Refunds are not guaranteed and are reviewed on a case-by-case basis in accordance with applicable consumer protection laws. To request a refund, contact support@oryxsolver.com.',
    },
    {
      heading: '9. Service Availability',
      body: 'We strive to ensure the Service is available at all times, but we do not guarantee uninterrupted access. Downtime for maintenance, updates, or technical outages may occur. We reserve the right to modify or discontinue any part of the Service as needed.',
    },
    {
      heading: '10. Limitation of Liability',
      body: 'The Service is provided “as is” and “as available” without warranties of any kind, whether express or implied. To the maximum extent permitted by law, the Company shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.',
    },
    {
      heading: '11. Changes to Terms',
      body: 'We may update these Terms from time to time. If we make material changes, we will notify users by updating the effective date or through the Service. Continued use of the Service after changes constitutes acceptance of the updated Terms.',
    },
    {
      heading: '12. Termination',
      body: 'We reserve the right to suspend or terminate your account and access to the Service at our sole discretion, without notice or liability, for reasons including a breach of these Terms or misuse of the platform.',
    },
    {
      heading: '13. Contact Information',
      body: `For legal questions, notices, or support, please contact us at ${DEFAULT_SUPPORT_EMAIL}.`,
    },
  ],
};

const FALLBACK_TERMS_AR: LegalDocument = {
  title: 'شروط الاستخدام',
  intro: 'من خلال الوصول إلى تطبيق OryxSolver ("الخدمة") أو استخدامه، الذي تديره OryxSolver ("الشركة" أو "نحن" أو "نحن" أو "خاصتنا")، فإنك توافق على الالتزام بشروط الاستخدام هذه ("الشروط"). تخضع هذه الشروط لقوانين الولاية القضائية التي تأسست فيها الشركة. وتخضع أي نزاعات للولاية القضائية الحصرية للمحاكم في تلك الولاية القضائية.',
  sections: [
    {
      heading: '1. قبول الشروط',
      body: 'تحكم شروط الاستخدام هذه وصولك إلى OryxSolver واستخدامه عبر تطبيق الويب وامتداد المتصفح والخدمات ذات الصلة. من خلال إنشائك للحساب أو استخدامك للخدمة، فإنك تعبر عن قبولك لهذه الشروط وسياسة الخصوصية الخاصة بنا.',
    },
    {
      heading: '2. وصف الخدمة',
      body: 'OryxSolver هي منصة برمجيات تعليمية مدعومة بالذكاء الاصطناعي (SaaS) تتيح للمستخدمين تحميل الأسئلة (نص أو صور أو ملفات PDF) وتلقي الإجابات والشروحات والمساعدة الدراسية التي يولدها الذكاء الاصطناعي. يتم توفير الخدمة كبرنامج رقمي فقط.',
    },
    {
      heading: '3. الأهلية ومتطلبات العمر',
      body: 'يجب ألا يقل عمرك عن 13 عامًا لاستخدام الخدمة. إذا كنت تحت سن 18 عامًا، فيجب أن تحصل على موافقة أحد والديك أو وصيك القانوني لاستخدام الخدمة. باستخدام الخدمة، فإنك تقر وتضمن أنك تستوفي متطلبات الأهلية هذه.',
    },
    {
      heading: '4. إخلاء مسؤولية الذكاء الاصطناعي والمسؤولية',
      body: 'يتم وضع الخدمة كمساعد دراسي وتعليمي. قد تكون المخرجات التي يولدها الذكاء الاصطناعي غير دقيقة أو غير كاملة أو مضللة. أنت تقر بأن الاستجابات يتم إنتاجها بواسطة أنظمة آلية قد تنتج أحياناً نتائج تتطلب مراجعة بشرية. بينما نسعى جاهدين لتحقيق جودة عالية، فإننا لا نضمن أن تكون جميع المخرجات دقيقة تماماً أو كاملة في جميع الأوقات. أنت مسؤول عن التحقق بشكل مستقل من المخرجات قبل الاعتماد عليها في القرارات الحاسمة.',
    },
    {
      heading: '5. النزاهة الأكاديمية',
      body: 'تم تصميم OryxSolver لمساعدتك على فهم الموضوعات المعقدة وتحسين كفاءتك الدراسية. وهي غير مخصصة لتسهيل عدم النزاهة الأكاديمية. أنت وحدك المسؤول عن ضمان توافق استخدامك للخدمة مع قواعد وسياسات مؤسستك التعليمية.',
    },
    {
      heading: '6. محتوى المستخدم والمعالجة',
      body: 'أنت تحتفظ بجميع حقوق الملكية للمحتوى الذي تحمله إلى الخدمة (نصوص أو صور أو ملفات PDF). قد يتم نقل محتوى المستخدم ومعالجته بواسطة موفري ذكاء اصطناعي تابعين لجهات خارجية لتوليد الاستجابات. يعمل هؤلاء الموفرون كمعالجين للبيانات نيابة عنا وقد يعالجون البيانات مؤقتًا وفقًا لسياسات الخصوصية الخاصة بهم.',
    },
    {
      heading: '7. الاستخدام المحظور',
      body: 'لا يجوز لك استخدام الخدمة لأي غرض غير قانوني، أو محاولة التدخل في أمن الخدمة، أو مشاركة بيانات اعتماد حسابك مع الآخرين. مشاركة بيانات اعتماد حسابك مع الآخرين محظورة تمامًا وقد تؤدي إلى حظر دائم لحسابك.',
    },
    {
      heading: '8. الاشتراكات وسياسة الاسترداد',
      body: 'يمكنك إدارة اشتراكك وإلغاء خطتك في أي وقت من خلال الخدمة. قد تتجدد الاشتراكات تلقائيًا ما لم يتم إلغاؤها. عمليات استرداد الأموال غير مضمونة وتتم مراجعتها على أساس كل حالة على حدة وفقًا لقوانين حماية المستهلك المعمول بها. لطلب استرداد الأموال، اتصل بـ support@oryxsolver.com.',
    },
    {
      heading: '9. توفر الخدمة',
      body: 'نحن نسعى جاهدين لضمان توفر الخدمة في جميع الأوقات، لكننا لا نضمن الوصول دون انقطاع. قد يحدث توقف للصيانة أو التحديثات أو الانقطاعات الفنية. نحتفظ بالحق في تعديل أو إيقاف أي جزء من الخدمة حسب الحاجة.',
    },
    {
      heading: '10. حدود المسؤولية',
      body: 'يتم توفير الخدمة "كما هي" و "كما هي متوفرة" دون ضمانات من أي نوع، سواء كانت صريحة أو ضمنية. إلى أقصى حد يسمح به القانون، لن تكون الشركة مسؤولة عن أي أضرار غير مباشرة أو عرضية أو تبعية تنشأ عن استخدامك للخدمة.',
    },
    {
      heading: '11. التغييرات على الشروط',
      body: 'قد نقوم بتحديث هذه الشروط من وقت لآخر. إذا أجرينا تغييرات جوهرية، فسنقوم بإخطار المستخدمين عن طريق تحديث تاريخ النفاذ أو من خلال الخدمة. ويشكل استمرار استخدام الخدمة بعد التغييرات قبولاً للشروط المحدثة.',
    },
    {
      heading: '12. الإنهاء',
      body: 'نحتفظ بالحق في تعليق أو إنهاء حسابك ووصولك إلى الخدمة وفقًا لتقديرنا الخاص، دون إشعار أو مسؤولية، لأسباب تشمل خرق هذه الشروط أو إساءة استخدام المنصة.',
    },
    {
      heading: '13. معلومات الاتصال',
      body: `للأسئلة القانونية أو الإخطارات أو الدعم، يرجى الاتصال بنا على ${DEFAULT_SUPPORT_EMAIL}.`,
    },
  ],
};

const FALLBACK_PRIVACY: LegalDocument = {
  title: 'Privacy Policy',
  intro: 'At OryxSolver, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and disclose your personal information.',
  sections: [
    {
      heading: '1. Introduction',
      body: 'This Privacy Policy explains what information OryxSolver collects, how it is used, when it is shared, and what choices may be available to you under applicable law.',
    },
    {
      heading: '2. Information We Collect',
      body: 'We collect only the information necessary to provide and improve our service. This includes Account Data (email, profile info) collected for account management, User Content (text, images, or PDFs) collected to generate AI responses, and Technical Data (IP address, browser type) to ensure service stability and prevent abuse.',
    },
    {
      heading: '3. Use of Information and Legal Basis',
      body: 'We process your data based on your consent and our legitimate interest in providing and improving the Service. Uses include generating responses for study questions, analyzing usage trends to enhance user experience, and responding to support inquiries.',
    },
    {
      heading: '4. Third-Party AI and International Transfers',
      body: 'We use third-party AI models to provide high-quality responses. These providers act as data processors on our behalf. Your data may be processed and stored on servers located outside of your country. By using the Service, you consent to this international processing.',
    },
    {
      heading: '5. Data Retention and Deletion',
      body: 'We retain your content and history while your account is active. You can delete your history or your entire account at any time through the Account Settings. Deleted account data is removed from our active databases within a reasonable period (typically 30 days), unless required otherwise by law.',
    },
    {
      heading: '6. User Rights',
      body: 'You have the right to access, rectify, or delete your personal data. These controls are available directly within the Settings section of the OryxSolver application.',
    },
    {
      heading: '7. Security',
      body: 'We implement professional-grade security measures to protect your data. However, no digital system is entirely immune to risk, and we encourage you to use strong passwords.',
    },
    {
      heading: '8. Contact Information',
      body: 'For privacy-related requests or questions about this policy, contact privacy@oryxsolver.com.',
    },
    {
      heading: '9. Google User Data',
      body: 'If you choose to sign in using your Google account, OryxSolver accesses your name and email address from your Google profile. We use this data only to manage your account and provide a personalized experience. Our use and transfer of information received from Google APIs to any other app will adhere to Google API Services User Data Policy, including the Limited Use requirements.',
    },
  ],
};

const FALLBACK_PRIVACY_AR: LegalDocument = {
  title: 'سياسة الخصوصية',
  intro: 'في OryxSolver، نحن ملتزمون بحماية خصوصيتك. تشرح سياسة الخصوصية هذه كيفية جمع معلوماتك الشخصية واستخدامها والكشف عنها.',
  sections: [
    {
      heading: '1. مقدمة',
      body: 'تشرح سياسة الخصوصية هذه المعلومات التي يجمعها OryxSolver، وكيفية استخدامها، ومتى يتم مشاركتها، وما هي الخيارات التي قد تكون متاحة لك بموجب القانون المعمول به.',
    },
    {
      heading: '2. المعلومات التي نجمعها',
      body: 'نحن نجمع فقط المعلومات اللازمة لتوفير خدمتنا وتحسينها. ويشمل ذلك بيانات الحساب (البريد الإلكتروني، معلومات الملف الشخصي) التي يتم جمعها لإدارة الحساب، ومحتوى المستخدم (نصوص أو صور أو ملفات PDF) التي يتم جمعها لتوليد استجابات الذكاء الاصطناعي، والبيانات التقنية (عنوان IP، نوع المتصفح) لضمان استقرار الخدمة ومنع الإساءة.',
    },
    {
      heading: '3. استخدام المعلومات والأساس القانوني',
      body: 'نقوم بمعالجة بياناتك بناءً على موافقتك ومصلحتنا المشروعة في توفير الخدمة وتحسينها. وتشمل الاستخدامات توليد إجابات لأسئلة الدراسة، وتحليل اتجاهات الاستخدام لتعزيز تجربة المستخدم، والرد على استفسارات الدعم.',
    },
    {
      heading: '4. الذكاء الاصطناعي من جهات خارجية والعمليات الدولية',
      body: 'نحن نستخدم نماذج ذكاء اصطناعي من جهات خارجية لتقديم استجابات عالية الجودة. يعمل هؤلاء الموفرون كمعالجي بيانات نيابة عنا. قد يتم معالجة بياناتك وتخزينها على خوادم تقع خارج بلدك. باستخدام الخدمة، فإنك توافق على هذه المعالجة الدولية.',
    },
    {
      heading: '5. الاحتفاظ بالبيانات وحذفها',
      body: 'نحتفظ بمحتواك وسجلك طالما كان حسابك نشطاً. يمكنك حذف سجلك أو بيانات محددة أو حسابك بالكامل في أي وقت من خلال إعدادات الحساب. يتم إزالة بيانات الحساب المحذوفة من قواعد بياناتنا النشطة في غضون فترة زمنية معقولة (عادةً 30 يومًا)، ما لم يقتض القانون الاحتفاظ بها لفترة أطول.',
    },
    {
      heading: '6. حقوق المستخدم',
      body: 'لديك الحق في الوصول إلى بياناتك الشخصية أو تصحيحها أو حذفها. تتوفر هذه الضوابط مباشرة في قسم الإعدادات في تطبيق OryxSolver.',
    },
    {
      heading: '7. الأمان',
      body: 'نحن نطبق تدابير أمنية احترافية لحماية بياناتك. ومع ذلك، لا يوجد نظام رقمي محصن تماماً من المخاطر، ونحن نشجعك على استخدام كلمات مرور قوية.',
    },
    {
      heading: '8. اتصل بنا',
      body: 'للطلبات المتعلقة بالخصوصية أو الأسئلة حول هذه السياسة، اتصل بـ privacy@oryxsolver.com.',
    },
    {
      heading: '9. بيانات مستخدم جوجل',
      body: 'إذا اخترت تسجيل الدخول باستخدام حساب جوجل الخاص بك، فإن OryxSolver يصل إلى اسمك وعنوان بريدك الإلكتروني من حساب جوجل الخاص بك. نحن نستخدم هذه البيانات فقط لإدارة حسابك وتقديم تجربة مخصصة. سيلتزم استخدامنا ونقلنا للمعلومات الواردة من واجهات برمجة تطبيقات جوجل إلى أي تطبيق آخر بسياسة بيانات مستخدم خدمات واجهة برمجة تطبيقات جوجل، بما في ذلك متطلبات الاستخدام المحدود.',
    },
  ],
};

const FALLBACK_FEATURES: ProductFeature[] = [
  {
    id: 'capture',
    title: 'Capture from any tab',
    enabled: true,
    description: 'Use the Chrome extension to capture questions directly from the page you are on.',
  },
  {
    id: 'explanations',
    title: 'Step-by-step explanations',
    enabled: true,
    description: 'Get structured reasoning designed to help you understand the answer, not just copy it.',
  },
  {
    id: 'modes',
    title: 'Multiple solve styles',
    enabled: true,
    description: 'Switch between Standard, Exam, ELI5, Step-by-step, and other answer styles based on the task.',
  },
  {
    id: 'history_sync',
    title: 'Shared web and extension history',
    enabled: true,
    description: 'Start in the extension and continue later in the web app with the same account data.',
  },
];

export const FALLBACK_PUBLIC_CONFIG: PublicAppConfig = {
  legalVersions: FALLBACK_LEGAL_VERSIONS,
  terms: FALLBACK_TERMS,
  privacy: FALLBACK_PRIVACY,
  features: FALLBACK_FEATURES,
  maintenance_mode: false,
  support: {
    email: DEFAULT_SUPPORT_EMAIL,
  },
};

export interface ConfigRow {
  key: ConfigKey;
  value: any;
}

const CACHE_KEY = 'oryx_public_config';

function readCachedPublicConfig(): PublicAppConfig | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function writeCachedPublicConfig(config: PublicAppConfig) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to cache public config:', error);
  }
}

function toPublicConfig(rows: ConfigRow[], lang: string): PublicAppConfig {
  const findValue = (key: ConfigKey) => rows.find((r) => r.key === key)?.value;

  const terms = lang === 'ar' 
    ? (findValue('terms_content_ar') || findValue('terms_content') || FALLBACK_TERMS_AR)
    : (findValue('terms_content') || FALLBACK_TERMS);

  const privacy = lang === 'ar'
    ? (findValue('privacy_content_ar') || findValue('privacy_content') || FALLBACK_PRIVACY_AR)
    : (findValue('privacy_content') || FALLBACK_PRIVACY);

  const featuresRow = findValue('product_features');
  const features = Array.isArray(featuresRow?.items) ? featuresRow.items : FALLBACK_FEATURES;

  const versions = findValue('legal_versions') || FALLBACK_LEGAL_VERSIONS;
  const maintenance = findValue('maintenance_mode') ?? false;
  const announcement = findValue('announcement_banner');

  return {
    legalVersions: {
      terms_version: String(versions.terms_version ?? FALLBACK_LEGAL_VERSIONS.terms_version),
      privacy_version: String(versions.privacy_version ?? FALLBACK_LEGAL_VERSIONS.privacy_version),
      effective_date: String(versions.effective_date ?? FALLBACK_LEGAL_VERSIONS.effective_date),
    },
    terms,
    privacy,
    features,
    maintenance_mode: maintenance,
    announcement: announcement?.active ? announcement : undefined,
    support: {
      email: DEFAULT_SUPPORT_EMAIL,
    },
  };
}

export async function fetchPublicAppConfig(lang: string = 'en'): Promise<PublicAppConfig> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', [
        'legal_versions', 
        'terms_content', 
        'privacy_content', 
        'terms_content_ar', 
        'privacy_content_ar',
        'product_features',
        'maintenance_mode',
        'announcement_banner'
      ]);

    if (error || !data) {
      throw error ?? new Error('Public app config unavailable');
    }

    const config = toPublicConfig(data as ConfigRow[], lang);
    writeCachedPublicConfig(config);
    markSuccess('db', 'Configuration loaded.');
    return config;
  } catch (error) {
    console.error('Failed to load public app config:', error);
    applyServiceHealthError(error, 'db');
    
    const cached = readCachedPublicConfig();
    if (cached) return cached;

    return {
      ...FALLBACK_PUBLIC_CONFIG,
      terms: lang === 'ar' ? FALLBACK_TERMS_AR : FALLBACK_TERMS,
      privacy: lang === 'ar' ? FALLBACK_PRIVACY_AR : FALLBACK_PRIVACY,
    };
  }
}
