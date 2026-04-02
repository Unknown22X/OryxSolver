import { supabase } from './supabase';
import { applyServiceHealthError, markSuccess } from './serviceHealth';

export type ConfigRow = {
  key: string;
  value: unknown;
  is_public: boolean;
  updated_at?: string;
};

export type LegalSection = {
  heading: string;
  body: string;
};

export type LegalDocument = {
  title: string;
  intro: string;
  sections: LegalSection[];
};

export type LegalVersions = {
  terms_version: string;
  privacy_version: string;
  effective_date: string;
};

export type ProductFeature = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
};

export type SupportContact = {
  email: string;
};

export type PublicAppConfig = {
  legalVersions: LegalVersions;
  terms: LegalDocument;
  privacy: LegalDocument;
  features: ProductFeature[];
  support: SupportContact;
  maintenanceMode: boolean;
  banner: {
    active: boolean;
    message: string;
    type: 'info' | 'warning' | 'success';
  } | null;
};

export const DEFAULT_SUPPORT_EMAIL = 'support@oryxsolver.com';

const FALLBACK_LEGAL_VERSIONS: LegalVersions = {
  terms_version: '2026-03-18',
  privacy_version: '2026-03-18',
  effective_date: '2026-03-18',
};

const FALLBACK_TERMS: LegalDocument = {
  title: 'Terms of Service',
  intro: 'These Terms of Service govern your access to and use of OryxSolver across the web application, browser extension, and related services.',
  sections: [
    {
      heading: '1. Acceptance and Scope',
      body: 'By creating an account, accessing, or using OryxSolver, you agree to these Terms and our Privacy Policy. These Terms apply to the website, browser extension, related APIs, support interactions, and any paid or free features we make available.',
    },
    {
      heading: '2. Eligibility and Account Security',
      body: 'You must be legally capable of entering into this agreement. You are responsible for maintaining accurate account information, protecting your login credentials, and all activity that occurs under your account. You must promptly notify us if you believe your account has been compromised.',
    },
    {
      heading: '3. Acceptable Use and Academic Integrity',
      body: 'You may use OryxSolver for lawful educational and productivity purposes. You may not use the service to violate school or employer rules, facilitate cheating, infringe intellectual property rights, probe or bypass security controls, scrape the service at scale, upload unlawful content, or interfere with other users or the platform.',
    },
    {
      heading: '4. User Content and Permissions',
      body: 'You retain ownership of prompts, screenshots, uploads, and other content you submit, subject to rights needed to operate the service. You grant us and our subprocessors a limited license to host, process, transmit, and analyze submitted content solely to provide, secure, support, and improve OryxSolver in accordance with our Privacy Policy.',
    },
    {
      heading: '5. AI Output and No Professional Advice',
      body: 'OryxSolver uses automated systems and AI models to generate outputs. Results may be incomplete, incorrect, biased, or unsuitable for your situation. The service is provided for general educational and informational assistance only and is not legal, financial, medical, academic, or other professional advice. You are responsible for reviewing and validating outputs before relying on them.',
    },
    {
      heading: '6. Paid Plans, Billing, and Auto-Renewal',
      body: 'Some features require payment. Prices, billing intervals, trial terms, and plan features are shown at checkout or in-product. By starting a paid subscription, you expressly agree to recurring charges until cancellation. Lemon Squeezy or another listed billing provider may act as merchant of record, process payments, collect applicable taxes, and manage billing records on our behalf. Taxes, currency conversion, and local fees may be added where required. We may change prices prospectively, and upgrades or downgrades may be prorated or take effect at the next billing cycle depending on the billing provider flow.',
    },
    {
      heading: '7. Cancellation',
      body: 'You may cancel a recurring subscription at any time through the billing controls we provide, the Lemon Squeezy customer portal, or support. Cancellation stops future renewal charges but does not retroactively cancel the current billing period, and access will generally continue through the end of the paid term unless otherwise required by law.',
    },
    {
      heading: '8. Refund Policy',
      body: 'Unless required by law or otherwise stated at checkout, payments for subscriptions and digital services are generally non-refundable once access has been granted. If you were charged in error, billed more than once, or experienced a reproducible technical issue that prevented reasonable access and we cannot fix it within a reasonable time, contact support within 14 days of the charge. We may issue a full or partial refund at our discretion or where required by law. Purchases processed by Lemon Squeezy are also subject to Lemon Squeezy refund and payment handling practices, and Lemon Squeezy may issue refunds or reversals under its own policies, including chargeback-prevention rules.',
    },
    {
      heading: '9. Chargebacks and Payment Disputes',
      body: 'If you believe a charge is incorrect, contact us before filing a chargeback so we can review the issue. Chargebacks, fraudulent payment activity, or repeated payment disputes may result in account review, suspension, or termination. Billing providers such as Lemon Squeezy may handle chargebacks directly and may issue refunds or payment reversals on our behalf.',
    },
    {
      heading: '10. Suspension, Termination, and Availability',
      body: 'We may modify, suspend, or discontinue features at any time, including for maintenance, security, legal compliance, or product changes. We may suspend or terminate access if we reasonably believe you violated these Terms, created risk for the service or others, or used the service unlawfully.',
    },
    {
      heading: '11. Intellectual Property',
      body: 'The OryxSolver service, software, branding, interface design, and related materials are owned by us or our licensors and protected by intellectual property laws. Except as expressly permitted, you may not copy, reverse engineer, distribute, sublicense, or create derivative works from the service.',
    },
    {
      heading: '12. Disclaimers and Limitation of Liability',
      body: 'To the maximum extent permitted by law, the service is provided on an as-is and as-available basis without warranties of any kind, express or implied. We are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, revenues, goodwill, data, or business opportunity arising from or related to your use of the service.',
    },
    {
      heading: '13. Changes and Contact',
      body: `We may update these Terms from time to time. Material changes may be posted in-product, on our website, or otherwise communicated to users. Your continued use after an updated effective date constitutes acceptance of the revised Terms to the extent permitted by law. For legal questions or notices, contact ${DEFAULT_SUPPORT_EMAIL}.`,
    },
  ],
};

const FALLBACK_TERMS_AR: LegalDocument = {
  title: 'شروط الخدمة',
  intro: 'تحكم شروط الخدمة هذه وصولك إلى OryxSolver واستخدامه عبر تطبيق الويب وامتداد المتصفح والخدمات ذات الصلة.',
  sections: [
    {
      heading: '1. القبول والنطاق',
      body: 'من خلال إنشاء حساب أو الوصول إلى OryxSolver أو استخدامه، فإنك توافق على هذه الشروط وسياسة الخصوصية الخاصة بنا. تنطبق هذه الشروط على الموقع الإلكتروني وامتداد المتصفح وواجهات برمجة التطبيقات ذات الصلة وتفاعلات الدعم وأي ميزات مدفوعة أو مجانية نوفرها.',
    },
    {
      heading: '2. الأهلية وأمن الحساب',
      body: 'يجب أن تكون قادرًا قانونيًا على الدخول في هذه الاتفاقية. أنت مسؤول عن الحفاظ على دقة معلومات الحساب وحماية بيانات اعتماد تسجيل الدخول الخاصة بك وجميع الأنشطة التي تحدث تحت حسابك. يجب عليك إخطارنا فورًا إذا كنت تعتقد أن حسابك قد تعرض للاختراق.',
    },
    {
      heading: '3. الاستخدام المقبول والنزاهة الأكاديمية',
      body: 'يمكنك استخدام OryxSolver لأغراض تعليمية وإنتاجية قانونية. لا يجوز لك استخدام الخدمة لانتهاك قواعد المدرسة أو صاحب العمل، أو تسهيل الغش، أو انتهاك حقوق الملكية الفكرية، أو فحص أو تجاوز ضوابط الأمان، أو كشط الخدمة على نطاق واسع، أو تحميل محتوى غير قانوني، أو التدخل مع المستخدمين الآخرين أو المنصة.',
    },
    {
      heading: '4. محتوى المستخدم والأذونات',
      body: 'أنت تحتفظ بملكية المطالبات ولقطات الشاشة والتحميلات والمحتويات الأخرى التي ترسلها، مع مراعاة الحقوق اللازمة لتشغيل الخدمة. أنت تمنحنا ولمعالجينا الفرعيين ترخيصًا محدودًا لاستضافة ومعالجة ونقل وتحليل المحتوى المقدم فقط لتوفير OryxSolver وتأمينه ودعمه وتحسينه وفقًا لسياسة الخصوصية الخاصة بنا.',
    },
    {
      heading: '5. مخرجات الذكاء الاصطناعي وعدم وجود نصيحة مهنية',
      body: 'يستخدم OryxSolver أنظمة آلية ونماذج ذكاء اصطناعي لتوليد المخرجات. قد تكون النتائج غير كاملة أو غير صحيحة أو متحيزة أو غير مناسبة لحالتك. يتم تقديم الخدمة للمساعدة التعليمية والإعلامية العامة فقط وليست نصيحة قانونية أو مالية أو طبية أو أكاديمية أو غيرها من النصائح المهنية. أنت مسؤول عن مراجعة المخرجات والتحقق من صحتها قبل الاعتماد عليها.',
    },
    {
      heading: '6. الخطط المدفوعة والفواتير والتجديد التلقائي',
      body: 'تتطلب بعض الميزات الدفع. يتم عرض الأسعار وفترات الفواتير وشروط التجربة وميزات الخطة عند الدفع أو في المنتج. من خلال بدء اشتراك مدفوع، فإنك توافق صراحة على الرسوم المتكررة حتى الإلغاء. قد يعمل Lemon Squeezy أو موفر فواتير آخر مدرج كتاجر سجل، ويعالج المدفوعات، ويجمع الضرائب المعمول بها، ويدير سجلات الفواتير نيابة عنا. قد تضاف الضرائب وتحويل العملات والرسوم المحلية حيثما كان ذلك مطلوبًا. قد نغير الأسعار مستقبلاً، وقد يتم احتساب الترقيات أو التنزيلات بالتناسب أو تدخل حيز التنفيذ في دورة الفوترة التالية اعتمادًا على تدفق موفر الفواتير.',
    },
    {
      heading: '7. الإلغاء',
      body: 'يمكنك إلغاء اشتراك متكرر في أي وقت من خلال عناصر تحكم الفواتير التي نوفرها، أو بوابة عملاء Lemon Squeezy، أو الدعم. يوقف الإلغاء رسوم التجديد المستقبلية ولكنه لا يلغي فترة الفوترة الحالية بأثر رجعي، وسيستمر الوصول عمومًا حتى نهاية المدة المدفوعة ما لم يقتض القانون خلاف ذلك.',
    },
    {
      heading: '8. سياسة الاسترداد',
      body: 'ما لم يقتض القانون خلاف ذلك أو ذكر خلاف ذلك عند الدفع، فإن المدفوعات للاشتراكات والخدمات الرقمية غير قابلة للاسترداد عمومًا بمجرد منح الوصول. إذا تم تحصيل رسوم منك عن طريق الخطأ، أو تمت فوترتك أكثر من مرة، أو واجهت مشكلة فنية قابلة للتكرار منعت الوصول المعقول ولا يمكننا إصلاحها في غضون وقت معقول، فاتصل بالدعم في غضون 14 يومًا من الرسوم. قد نصدر استردادًا كليًا أو جزئيًا وفقًا لتقديرنا أو حيثما يقتض القانون. تخضع المشتريات التي تتم معالجتها بواسطة Lemon Squeezy أيضًا لممارسات الاسترداد ومعالجة الدفع الخاصة بـ Lemon Squeezy، وقد يصدر Lemon Squeezy عمليات استرداد أو عكس بموجب سياساته الخاصة، بما في ذلك قواعد منع استرداد الرسوم.',
    },
    {
      heading: '9. استرداد الرسوم والمنازعات المتعلقة بالدفع',
      body: 'إذا كنت تعتقد أن الرسوم غير صحيحة، فاتصل بنا قبل تقديم طلب استرداد الرسوم حتى نتمكن من مراجعة المشكلة. قد تؤدي عمليات استرداد الرسوم أو نشاط الدفع الاحتيالي أو منازعات الدفع المتكررة إلى مراجعة الحساب أو تعليقه أو إنهائه. قد يتعامل موفرو الفواتير مثل Lemon Squeezy مع عمليات استرداد الرسوم مباشرة وقد يصدرون عمليات استرداد أو عكس للدفع نيابة عنا.',
    },
    {
      heading: '10. التعليق والإنهاء والتوافر',
      body: 'قد نقوم بتعديل الميزات أو تعليقها أو إيقافها في أي وقت، بما في ذلك للصيانة أو الأمن أو الامتثال القانوني أو تغييرات المنتج. قد نقوم بتعليق أو إنهاء الوصول إذا اعتقدنا بشكل معقول أنك انتهكت هذه الشروط، أو تسببت في خطر على الخدمة أو الآخرين، أو استخدمت الخدمة بشكل غير قانوني.',
    },
    {
      heading: '11. الملكية الفكرية',
      body: 'إن خدمة OryxSolver والبرامج والعلامات التجارية وتصميم الواجهة والمواد ذات الصلة مملوكة لنا أو لمرخصينا ومحمية بموجب قوانين الملكية الفكرية. باستثناء ما هو مسموح به صراحةً، لا يجوز لك نسخ الخدمة أو هندستها عكسيًا أو توزيعها أو ترخيصها من الباطن أو إنشاء أعمال مشتقة منها.',
    },
    {
      heading: '12. إخلاء المسؤولية وحدود المسؤولية',
      body: 'إلى أقصى حد يسمح به القانون، يتم تقديم الخدمة على أساس "كما هي" و "كما هي متوفرة" دون ضمانات من أي نوع، صريحة أو ضمنية. نحن لسنا مسؤولين عن الأضرار غير المباشرة أو العرضية أو الخاصة أو التبعية أو التحذيرية أو العقابية، أو عن خسارة الأرباح أو الإيرادات أو الشهرة أو البيانات أو فرص العمل الناشئة عن أو المتعلقة باستخدامك للخدمة.',
    },
    {
      heading: '13. التغييرات والاتصال',
      body: `قد نقوم بتحديث هذه الشروط من وقت لآخر. قد يتم نشر التغييرات الجوهرية في المنتج، أو على موقعنا الإلكتروني، أو إبلاغها للمستخدمين بطريقة أخرى. يشكل استمرار استخدامك بعد تاريخ نفاذ محدث قبولًا للشروط المنقحة إلى الحد الذي يسمح به القانون. للأسئلة القانونية أو الإخطارات، اتصل بـ ${DEFAULT_SUPPORT_EMAIL}.`,
    },
  ],
};

const FALLBACK_PRIVACY: LegalDocument = {
  title: 'Privacy Policy',
  intro: 'This Privacy Policy explains what information OryxSolver collects, how it is used, when it is shared, and what choices may be available to you under applicable law.',
  sections: [
    {
      heading: '1. Scope and Contact',
      body: 'This Privacy Policy applies to OryxSolver websites, browser extensions, customer support interactions, and related services. If you have questions or privacy requests, contact privacy@oryxsolver.com.',
    },
    {
      heading: '2. Categories of Information We Collect',
      body: 'We may collect account identifiers such as name, email address, authentication data, and profile image; content you submit such as prompts, screenshots, images, files, and conversation history; device, browser, log, and usage information; billing and subscription status information; support communications; and security or fraud-prevention information.',
    },
    {
      heading: '3. Sources of Information',
      body: 'We collect information directly from you, automatically from your device and browser when you use the service, from authentication providers you choose to use, and from billing or fraud-prevention providers involved in your transactions.',
    },
    {
      heading: '4. Why We Use Information',
      body: 'We use personal information to provide and maintain the service, authenticate users, process prompts and uploads, generate responses, enforce usage limits, personalize settings, process subscriptions, monitor quality, prevent abuse, investigate incidents, comply with legal obligations, and communicate with you about your account or the service.',
    },
    {
      heading: '5. Legal Bases for Processing',
      body: 'Where data protection law requires a legal basis, we generally process information because it is necessary to perform our contract with you, because we have legitimate interests in operating and securing the service, because you consented to specific processing, or because processing is required to comply with legal obligations.',
    },
    {
      heading: '6. Payments and Billing Providers',
      body: 'Payments are handled by third-party billing providers such as Lemon Squeezy. We do not store full payment card details on our own systems. We may receive limited billing information such as purchase status, subscription tier, renewal or cancellation status, and customer identifiers necessary to manage access and support.',
    },
    {
      heading: '7. Sharing and Disclosure',
      body: 'We may share information with service providers that support hosting, analytics, authentication, AI processing, customer support, billing, fraud prevention, and security. We may also disclose information when required by law, to protect rights or safety, in connection with a business transaction, or with your direction.',
    },
    {
      heading: '8. International Transfers',
      body: 'Your information may be processed in countries other than where you live. Where applicable law requires safeguards for cross-border transfers, we will rely on appropriate mechanisms such as contractual protections or other lawful transfer tools.',
    },
    {
      heading: '9. Retention',
      body: 'We retain different categories of personal information for different periods depending on why the information was collected. Account information is generally kept while your account is active and for a reasonable period afterward for security, backup, and dispute-resolution purposes. Prompt history, uploads, and usage records are generally kept until you delete them, close your account, or we no longer need them for service operation, abuse prevention, or legal compliance. Billing and transaction records may be retained for longer where needed for tax, accounting, audit, or legal obligations.',
    },
    {
      heading: '10. Security',
      body: 'We use administrative, technical, and organizational safeguards designed to protect personal information. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.',
    },
    {
      heading: '11. Cookies, Local Storage, and Analytics',
      body: 'We may use cookies, local storage, pixels, analytics tools, and similar technologies to remember preferences, maintain sessions, understand usage, and improve product performance. You can control some of these technologies through browser or device settings, although disabling them may affect functionality.',
    },
    {
      heading: '12. Children’s Privacy',
      body: 'OryxSolver is not directed to young children and we do not knowingly collect personal information from children in violation of applicable law. If you believe a child provided personal information unlawfully, contact us and we will review and take appropriate action.',
    },
    {
      heading: '13. Your Rights and Choices',
      body: 'Depending on your location, you may have rights to access, correct, delete, restrict, object to, or export certain personal information, as well as rights to withdraw consent where processing is based on consent. California residents may also have rights to know, correct, delete, and receive information about certain disclosures of personal information, subject to applicable exceptions. We may need to verify your identity before completing a request, and you can submit requests by contacting privacy@oryxsolver.com.',
    },
    {
      heading: '14. California Privacy Disclosures',
      body: 'If you are a California resident and applicable law covers our processing, you may have rights to know, access, correct, delete, and receive information about disclosures of your personal information. As of the effective date of this policy, we do not sell personal information for money. If we ever engage in selling or sharing personal information in a way that triggers California opt-out rights, we will provide the required notices and honor legally required preference signals, including Global Privacy Control where applicable.',
    },
    {
      heading: '15. Changes to This Policy',
      body: 'We may update this Privacy Policy from time to time to reflect legal, technical, or product changes. We will post the current version with an updated effective date and may provide additional notice when required by law.',
    },
    {
      heading: '16. Contact',
      body: 'For privacy requests, data rights requests, or questions about this Privacy Policy, contact privacy@oryxsolver.com.',
    },
  ],
};

const FALLBACK_PRIVACY_AR: LegalDocument = {
  title: 'سياسة الخصوصية',
  intro: 'تشرح سياسة الخصوصية هذه المعلومات التي يجمعها OryxSolver، وكيفية استخدامها، ومتى يتم مشاركتها، وما هي الخيارات التي قد تكون متاحة لك بموجب القانون المعمول به.',
  sections: [
    {
      heading: '1. النطاق والاتصال',
      body: 'تنطبق سياسة الخصوصية هذه على مواقع OryxSolver وامتدادات المتصفح وتفاعلات دعم العملاء والخدمات ذات الصلة. إذا كانت لديك أسئلة أو طلبات تتعلق بالخصوصية، فاتصل بـ privacy@oryxsolver.com.',
    },
    {
      heading: '2. فئات المعلومات التي نجمعها',
      body: 'قد نجمع معرفات الحساب مثل الاسم وعنوان البريد الإلكتروني وبيانات المصادقة وصورة الملف الشخصي؛ المحتوى الذي ترسبه مثل المطالبات ولقطات الشاشة والصور والملفات وسجل المحادثات؛ معلومات الجهاز والمتصفح والسجل والاستخدام؛ معلومات حالة الفواتير والاشتراك؛ اتصالات الدعم؛ ومعلومات الأمن أو منع الاحتيال.',
    },
    {
      heading: '3. مصادر المعلومات',
      body: 'نحن نجمع المعلومات بشكل مباشر منك، وتلقائيًا من جهازك ومتصفحك عند استخدام الخدمة، ومن موفري المصادقة الذين تختار استخدامهم، ومن موفري الفواتير أو منع الاحتيال المشاركين في معاملاتك.',
    },
    {
      heading: '4. لماذا نستخدم المعلومات',
      body: 'نحن نستخدم المعلومات الشخصية لتوفير الخدمة وصيانتها، ومصادقة المستخدمين، ومعالجة المطالبات والتحميلات، وتوليد الردود، وفرض حدود الاستخدام، وتخصيص الإعدادات، ومعالجة الاشتراكات، ومراقبة الجودة، ومنع الإساءة، والتحقيق في الحوادث، والامتثال للالتزامات القانونية، والتواصل معك بشأن حسابك أو الخدمة.',
    },
    {
      heading: '5. القواعد القانونية للمعالجة',
      body: 'حيثما يتطلب قانون حماية البيانات أساسًا قانونيًا، فإننا نعالج المعلومات بشكل عام لأنها ضرورية لتنفيذ عقدنا معك، ولأن لدينا مصالح مشروعة في تشغيل الخدمة وتأمينها، ولأنك وافقت على معالجة محددة، أو لأن المعالجة مطلوبة للامتثال للالتزامات القانونية.',
    },
    {
      heading: '6. المدفوعات وموفرو الفواتير',
      body: 'تتم معالجة المدفوعات بواسطة موفري فواتير تابعين لجهات خارجية مثل Lemon Squeezy. نحن لا نخزن تفاصيل بطاقة الدفع الكاملة على أنظمتنا الخاصة. قد نتلقى معلومات فواتير محدودة مثل حالة الشراء، وفئة الاشتراك، وحالة التجديد أو الإلغاء، ومعرفات العملاء اللازمة لإدارة الوصول والدعم.',
    },
    {
      heading: '7. المشاركة والإفصاح',
      body: 'قد نشارك المعلومات مع موفري الخدمة الذين يدعمون الاستضافة والتحليلات والمصادقة ومعالجة الذكاء الاصطناعي ودعم العملاء والفواتير ومنع الاحتيال والأمن. قد نفصح أيضًا عن المعلومات عندما يقتضي القانون ذلك، أو لحماية الحقوق أو السلامة، أو فيما يتعلق بمعاملة تجارية، أو بتوجيه منك.',
    },
    {
      heading: '8. التحويلات الدولية',
      body: 'قد تتم معالجة معلوماتك في بلدان أخرى غير المكان الذي تعيش فيه. حيثما يتطلب القانون المعمول به ضمانات لعمليات النقل عبر الحدود، سنعتمد على آليات مناسبة مثل الحماية التعاقدية أو أدوات النقل القانونية الأخرى.',
    },
    {
      heading: '9. الاحتفاظ بالبيانات',
      body: 'نحن نحتفظ بفئات مختلفة من المعلومات الشخصية لفترات مختلفة اعتمادًا على سبب جمع المعلومات. يتم الاحتفاظ بمعلومات الحساب بشكل عام طالما أن حسابك نشط ولنشرة معقولة بعد ذلك لأغراض الأمن والنسخ الاحتياطي وحل النزاعات. يتم الاحتفاظ بسجل المطالبات والتحميلات وسجلات الاستخدام بشكل عام حتى تقوم بحذفها أو إغلاق حسابك أو لم نعد بحاجة إليها لتشغيل الخدمة أو منع الإساءة أو الامتثال القانوني. قد يتم الاحتفاظ بسجلات الفواتير والمعاملات لفترة أطول حيث تبرز الحاجة لأغراض الضريبة أو المحاسبة أو التدقيق أو الالتزامات القانونية.',
    },
    {
      heading: '10. الأمن',
      body: 'نحن نستخدم ضمانات إدارية وتقنية وتنظيمية مصممة لحماية المعلومات الشخصية. لا توجد طريقة نقل أو تخزين آمنة تمامًا، لذا لا يمكننا ضمان الأمن المطلق.',
    },
    {
      heading: '11. ملفات تعريف الارتباط والتخزين المحلي والتحليلات',
      body: 'قد نستخدم ملفات تعريف الارتباط والتخزين المحلي والبكسل وأدوات التحليلات وتقنيات مماثلة لتذكر التفضيلات والحفاظ على الجلسات وفهم الاستخدام وتحسين أداء المنتج. يمكنك التحكم في بعض هذه التقنيات من خلال إعدادات المتصفح أو الجهاز، على الرغم من أن تعطيلها قد يؤثر على الوظيفة.',
    },
    {
      heading: '12. خصوصية الأطفال',
      body: 'إن OryxSolver غير موجه للأطفال الصغار ونحن لا نجمع معلومات شخصية عن علم من الأطفال في انتهاك للقانون المعمول به. إذا كنت تعتقد أن طفلاً قدم معلومات شخصية بشكل غير قانوني، فاتصل بنا وسنقوم بالمراجعة واتخاذ الإجراء المناسب.',
    },
    {
      heading: '13. حقوقك وخياراتك',
      body: 'اعتمادًا على موقعك، قد يكون لديك حقوق في الوصول إلى معلومات شخصية معينة أو تصحيحها أو حذفها أو تقييدها أو الاعتراض عليها أو تصديرها، بالإضافة إلى حقوق سحب الموافقة حيثما تعتمد المعالجة على الموافقة. قد يكون لسكان كاليفورنيا أيضًا حقوق في المعرفة والتصحيح والحذف وتلقي المعلومات حول بعض الإفصاحات عن المعلومات الشخصية، مع مراعاة الاستثناءات المعمول بها. قد نحتاج إلى التحقق من هويتك قبل إكمال الطلب، ويمكنك تقديم الطلبات عن طريق الاتصال بـ privacy@oryxsolver.com.',
    },
    {
      heading: '14. إفصاحات الخصوصية في كاليفورنيا',
      body: 'إذا كنت من سكان كاليفورنيا ويغطي القانون المعمول به معالجتنا، فقد يكون لديك حقوق في المعرفة والوصول والتصحيح والحذف وتلقي معلومات حول الإفصاحات عن معلوماتك الشخصية. اعتبارًا من تاريخ نفاذ هذه السياسة، نحن لا نبيع المعلومات الشخصية مقابل المال. إذا انخرطنا في أي وقت في بيع أو مشاركة المعلومات الشخصية بطريقة تؤدي إلى تفعيل حقوق الرفض في كاليفورنيا، فسنقدم الإخطارات المطلوبة ونحترم إشارات التفضيل المطلوبة قانونًا، بما في ذلك التحكم العالمي في الخصوصية حيثما انطبق ذلك.',
    },
    {
      heading: '15. التغييرات في هذه السياسة',
      body: 'قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر لتعكس التغييرات القانونية أو التقنية أو المتعلقة بالمنتج. سننشر النسخة الحالية مع تاريخ نفاذ محدث وقد نقدم إشعارًا إضافيًا عندما يتطلبه القانون.',
    },
    {
      heading: '16. الاتصال',
      body: 'لطلبات الخصوصية أو طلبات حقوق البيانات أو الأسئلة حول سياسة الخصوصية هذه، اتصل بـ privacy@oryxsolver.com.',
    },
  ],
};

const FALLBACK_FEATURES: ProductFeature[] = [
  {
    id: 'capture',
    title: 'Screenshot solving',
    description: 'Placeholder: highlight a question on the page and send it to OryxSolver without leaving the tab.',
    enabled: true,
  },
  {
    id: 'explanations',
    title: 'Clean worked solutions',
    description: 'Placeholder: answers can show a final answer, ordered steps, and a short explanation that adds context.',
    enabled: true,
  },
  {
    id: 'modes',
    title: 'Solve modes',
    description: 'Placeholder: users can choose the response style before starting a thread.',
    enabled: true,
  },
  {
    id: 'threaded_followups',
    title: 'Threaded follow-ups',
    description: 'Placeholder: keep one main question and continue with follow-up questions inside the same conversation.',
    enabled: true,
  },
  {
    id: 'history_sync',
    title: 'Shared account data',
    description: 'Placeholder: profile, history, and usage should stay in sync between the web app and extension.',
    enabled: true,
  },
];

const FALLBACK_SUPPORT_CONTACT: SupportContact = {
  email: DEFAULT_SUPPORT_EMAIL,
};

export const FALLBACK_PUBLIC_CONFIG: PublicAppConfig = {
  legalVersions: FALLBACK_LEGAL_VERSIONS,
  terms: FALLBACK_TERMS,
  privacy: FALLBACK_PRIVACY,
  features: FALLBACK_FEATURES,
  support: FALLBACK_SUPPORT_CONTACT,
  maintenanceMode: false,
  banner: null,
};

const APP_CONFIG_CACHE_KEY = 'oryx_public_app_config_cache';

function readCachedPublicConfig(): PublicAppConfig | null {
  try {
    const raw = localStorage.getItem(APP_CONFIG_CACHE_KEY);
    return raw ? (JSON.parse(raw) as PublicAppConfig) : null;
  } catch {
    return null;
  }
}

function writeCachedPublicConfig(config: PublicAppConfig) {
  try {
    localStorage.setItem(APP_CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage failures.
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function parseLegalSections(value: unknown): LegalSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((section) => asObject(section))
    .map((section) => ({
      heading: String(section.heading ?? '').trim(),
      body: String(section.body ?? '').trim(),
    }))
    .filter((section) => section.heading && section.body);
}

function parseLegalDocument(value: unknown, fallback: LegalDocument): LegalDocument {
  const obj = asObject(value);
  const sections = parseLegalSections(obj.sections);
  return {
    title: String(obj.title ?? fallback.title),
    intro: String(obj.intro ?? fallback.intro),
    sections: sections.length > 0 ? sections : fallback.sections,
  };
}

function parseLegalVersions(value: unknown): LegalVersions {
  const obj = asObject(value);
  return {
    terms_version: String(obj.terms_version ?? FALLBACK_LEGAL_VERSIONS.terms_version),
    privacy_version: String(obj.privacy_version ?? FALLBACK_LEGAL_VERSIONS.privacy_version),
    effective_date: String(obj.effective_date ?? FALLBACK_LEGAL_VERSIONS.effective_date),
  };
}

function parseFeatures(value: unknown): ProductFeature[] {
  const obj = asObject(value);
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const parsed = rawItems
    .map((item) => asObject(item))
    .map((item, index) => ({
      id: String(item.id ?? `feature_${index + 1}`),
      title: String(item.title ?? ''),
      description: String(item.description ?? ''),
      enabled: item.enabled !== false,
    }))
    .filter((item) => item.title && item.description);
  return parsed.length > 0 ? parsed : FALLBACK_FEATURES;
}

function parseSupportContact(value: unknown): SupportContact {
  const obj = asObject(value);
  const email = String(obj.email ?? DEFAULT_SUPPORT_EMAIL).trim().toLowerCase();
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return {
    email: isValidEmail ? email : DEFAULT_SUPPORT_EMAIL,
  };
}

function toPublicConfig(rows: ConfigRow[], lang: string = 'en'): PublicAppConfig {
  const rowMap = new Map<string, unknown>();
  for (const row of rows) rowMap.set(row.key, row.value);

  const finalTerms = lang === 'ar' 
    ? parseLegalDocument(rowMap.get('terms_content_ar'), FALLBACK_TERMS_AR)
    : parseLegalDocument(rowMap.get('terms_content'), FALLBACK_TERMS);

  const finalPrivacy = lang === 'ar'
    ? parseLegalDocument(rowMap.get('privacy_content_ar'), FALLBACK_PRIVACY_AR)
    : parseLegalDocument(rowMap.get('privacy_content'), FALLBACK_PRIVACY);

  return {
    legalVersions: parseLegalVersions(rowMap.get('legal_versions')),
    terms: finalTerms,
    privacy: finalPrivacy,
    features: parseFeatures(rowMap.get('product_features')).filter((item) => item.enabled),
    support: parseSupportContact(rowMap.get('support_contact')),
    maintenanceMode: Boolean(rowMap.get('maintenance_mode') ?? false),
    banner: (rowMap.get('announcement_banner') ?? null) as any,
  };
}

export async function fetchPublicAppConfig(lang: string = 'en'): Promise<PublicAppConfig> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('key,value,is_public,updated_at')
      .eq('is_public', true)
      .in('key', ['legal_versions', 'terms_content', 'terms_content_ar', 'privacy_content', 'privacy_content_ar', 'product_features', 'support_contact', 'announcement_banner', 'maintenance_mode']);

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
