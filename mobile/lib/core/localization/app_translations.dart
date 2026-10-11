class AppTranslations {
  static const Map<String, Map<String, String>> localized = {
    'th': {
      // Home Shell
      'nav.home': 'หน้าหลัก',
      'nav.outbreak': 'พื้นที่ระบาด',
      'nav.wiki': 'คลังโรคข้าว',
      'nav.profile': 'โปรไฟล์',

      // Home Screen
      'home.diagnose': 'วิเคราะห์โรค',
      'home.diagnose_desc': 'AI ช่วยตรวจโรคจากใบ',
      'home.outbreak': 'พื้นที่ระบาด',
      'home.outbreak_desc': 'สถานการณ์ล่าสุด',
      'home.wiki': 'คลังความรู้',
      'home.wiki_desc': 'ข้อมูลโรคข้าว',
      'home.profile': 'โปรไฟล์',
      'home.profile_desc': 'จัดการบัญชี',

      // Outbreak Section (Home)
      'outbreak.title': 'สถานการณ์โรคระบาด',
      'outbreak.view_all': 'ดูทั้งหมด',
      
      // AI Diagnostic System (Home)
      'ai.title': 'ระบบวิเคราะห์อัจฉริยะ',
      'ai.desc': 'ถ่ายภาพใบข้าวเพื่อตรวจหาโรคทันที',
      'ai.scan_button': 'สแกนตรวจโรค',
    },
    'en': {
      // Home Shell
      'nav.home': 'Home',
      'nav.outbreak': 'Outbreak Map',
      'nav.wiki': 'Wiki',
      'nav.profile': 'Profile',

      // Home Screen
      'home.diagnose': 'Diagnose',
      'home.diagnose_desc': 'AI Leaf Diagnosis',
      'home.outbreak': 'Outbreaks',
      'home.outbreak_desc': 'Latest situations',
      'home.wiki': 'Knowledge Base',
      'home.wiki_desc': 'Rice diseases',
      'home.profile': 'Profile',
      'home.profile_desc': 'Manage account',

      // Outbreak Section (Home)
      'outbreak.title': 'Outbreak Status',
      'outbreak.view_all': 'View All',

      // AI Diagnostic System (Home)
      'ai.title': 'AI Diagnostic System',
      'ai.desc': 'Take a photo of a rice leaf to detect diseases instantly',
      'ai.scan_button': 'Scan Disease',
    }
  };

  static String tr(String key, String langCode) {
    return localized[langCode]?[key] ?? localized['th']?[key] ?? key;
  }
}
