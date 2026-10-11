class RiceDiseaseData {
  final String code;
  final String name;
  final String scientificName;
  final String category; // เชื้อรา, แบคทีเรีย, ไวรัส, ปกติ
  final String riskLevel; // เสี่ยงสูง, ปานกลาง, ปลอดภัย
  final String shortDescription;
  final String imageUrl;

  // ส่วนเกษตรกร (เข้าใจง่าย)
  final String farmerSymptoms;
  final String farmerPrevention;

  // ส่วนเจาะลึกวิชาการ (อ้างอิงกรมการข้าว)
  final String academicSymptoms;
  final String academicEnvironment;
  final String academicPrevention;

  final List<String> recommendedChemicals;
  final String statProvinces;
  final String statRegions;

  const RiceDiseaseData({
    required this.code,
    required this.name,
    required this.scientificName,
    required this.category,
    required this.riskLevel,
    required this.shortDescription,
    required this.imageUrl,
    required this.farmerSymptoms,
    required this.farmerPrevention,
    required this.academicSymptoms,
    required this.academicEnvironment,
    required this.academicPrevention,
    required this.recommendedChemicals,
    required this.statProvinces,
    required this.statRegions,
  });
}

class RiceDepartmentData {
  static const List<RiceDiseaseData> diseases = [
    RiceDiseaseData(
      code: 'BLAST',
      name: 'โรคใบไหม้ (Rice Blast)',
      scientificName: 'Pyricularia oryzae',
      category: 'เชื้อรา',
      riskLevel: 'เสี่ยงสูง',
      shortDescription: 'แผลกลมสีน้ำตาลขอบเทา รูปตา ระบาดในสภาพชื้นสูง ทำลายทุกส่วนของต้นข้าว',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Rice_blast_Magnaporthe_grisea.jpg',

      // Farmer View
      farmerSymptoms:
          'ใบข้าวมีแผลช้ำๆ แล้วกลายเป็นจุดสีน้ำตาลตรงกลางสีเทา คล้ายรูปตา ถ้าเป็นเยอะแผลจะติดกันทำให้ใบแห้งตายเหมือนโดนไฟไหม้ ถ้าเป็นตอนข้าวออกรวง รวงจะหัก เม็ดจะลีบ',
      farmerPrevention:
          'อย่าหว่านข้าวแน่นเกินไป และอย่าใส่ปุ๋ยยูเรีย (ปุ๋ยเคมีสูตรไนโตรเจนสูง) มากเกินไป หมั่นเดินดูนาตอนเช้าๆ ที่มีน้ำค้างจัด',

      // Academic View
      academicSymptoms:
          'ระยะกล้าถึงระยะแตกกอ: พบแผลที่ใบ มีลักษณะคล้ายรูปตาชั่ง ขอบสีน้ำตาล ตรงกลางแผลมีสีเทา หากรุนแรงแผลจะขยายติดกันทำให้ใบแห้งตาย คล้ายถูกไฟไหม้ (Blast)\n\nระยะออกรวง (โรคใบไหม้คอรวง): เชื้อราเข้าทำลายที่ข้อต่อ รวงข้าวจะหักพับคาต้น เม็ดลีบทั้งหมด',
      academicEnvironment:
          'อากาศเย็น ค่อนข้างชื้น มีหมอกตกจัดในตอนเช้า (อุณหภูมิประมาณ 22–25 °C) ประกอบกับการใส่ปุ๋ยที่มีธาตุไนโตรเจนสูงจัด หรือหว่านข้าวหนาแน่นเกินไปจนอากาศไม่ถ่ายเท',
      academicPrevention:
          '1. ใช้พันธุ์ข้าวต้านทาน เช่น สุพรรณบุรี 1, กฤ41\n2. คลุกเม็ดพันธุ์ก่อนปลูกด้วยสารป้องกันเชื้อรา เช่น Mancozeb\n3. ฉีดพ่นเคมีเมื่อพบแผลเกิน 5% ของพื้นที่นา',

      recommendedChemicals: ['Tricyclazole', 'Kasugamycin', 'Isoprothiolane'],
      statProvinces: '18 จังหวัดเสี่ยง',
      statRegions: 'ระบาดทุกภาค',
    ),
    RiceDiseaseData(
      code: 'BLB',
      name: 'โรคขอบใบแห้ง (Bacterial Leaf Blight)',
      scientificName: 'Xanthomonas oryzae pv. oryzae',
      category: 'แบคทีเรีย',
      riskLevel: 'เสี่ยงสูง',
      shortDescription: 'ขอบใบเหลืองจากปลายเข้าหาโคน แพร่กระจายทางน้ำและบาดแผล พบมากในฤดูฝน',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Bacterial_blight_of_rice.jpeg',

      // Farmer View
      farmerSymptoms:
          'ขอบใบข้าวจะเริ่มเป็นรอยช้ำๆ สีเหลืองอ่อน แล้วค่อยๆ แห้งลามจากปลายใบลงมาที่โคนใบ ถ้าเป็นหนักใบจะม้วนและแห้งตายทั้งต้น มักระบาดหนักตอนฝนตกหนักหรือพายุเข้า',
      farmerPrevention:
          'ระบายน้ำออกจากแปลงนาอย่าให้ขังนานเกินไป งดปุ๋ยยูเรียชั่วคราว และอย่าเดินลุยนาตอนที่ใบข้าวเปียกเพราะจะทำให้เชื้อติดเสื้อผ้าไปติดต้นอื่น',

      // Academic View
      academicSymptoms:
          'อาการเริ่มแรกพบรอยช้ำชุ่มน้ำที่ขอบใบ จากนั้นแผลจะเปลี่ยนเป็นสีเหลืองและลามลงไปตามความยาวของใบ เมื่อแผลแห้งจะเปลี่ยนเป็นสีขาวซีดหรือเทา ขอบแผลมีลักษณะเป็นรอยหยัก',
      academicEnvironment:
          'เกิดจากการพัดพาของน้ำ สภาพอากาศร้อนชื้น ฝนตกหนัก มีลมพายุรุนแรงที่ทำให้ใบข้าวเกิดบาดแผล เชื้อแบคทีเรียจะเข้าสู่ต้นข้าวผ่านบาดแผลและช่องเปิดตามธรรมชาติ',
      academicPrevention:
          '1. หลีกเลี่ยงการหว่านข้าวหนาแน่น\n2. ไม่ควรใส่ปุ๋ยไนโตรเจนมากเกินไป\n3. ใช้พันธุ์ต้านทาน เช่น กข31\n4. พ่นสารป้องกันกำจัดแบคทีเรียประเภทสารประกอบทองแดง (Copper compounds)',

      recommendedChemicals: ['Copper Hydroxide', 'Streptomycin', 'Kasugamycin'],
      statProvinces: '14 จังหวัดเสี่ยง',
      statRegions: 'พบจริงแล้ว!',
    ),
    RiceDiseaseData(
      code: 'TUNGRO',
      name: 'โรคใบสีส้ม (Rice Tungro)',
      scientificName: 'Rice Tungro Virus',
      category: 'ไวรัส',
      riskLevel: 'ปานกลาง',
      shortDescription: 'ไวรัส 2 ชนิด พาหะโดยเพลี้ยจักจั่นสีเขียว ใบเปลี่ยนสีส้มเหลือง ต้นเตี้ยผิดปกติ',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Rice_plants_affected_by_tungro_disease1.jpg',

      // Farmer View
      farmerSymptoms:
          'ข้าวจะแกร็น ต้นเตี้ยไม่ยอมโต ใบเปลี่ยนจากสีเขียวเป็นสีเหลืองส้มลามจากปลายใบลงมา และมักจะเห็นแมลงกระโดดสีเขียวเล็กๆ (เพลี้ยจักจั่น) บินอยู่ในนา',
      farmerPrevention:
          'ต้องกำจัดแมลงพาหะคือ "เพลี้ยจักจั่นสีเขียว" ถอนต้นที่ป่วยไปเผาทิ้งเพื่อไม่ให้เชื้อลาม และพักดินไม่ทำนาต่อเนื่องตลอดปีเพื่อตัดวงจร',

      // Academic View
      academicSymptoms:
          'ต้นข้าวแคระแกร็น แตกกอน้อย ใบมีสีเหลืองส้มเริ่มจากปลายใบเข้าหาโคนใบ บางครั้งพบจุดสีน้ำตาลประปราย การเจริญเติบโตหยุดชะงัก ข้าวออกรวงช้าและรวงไม่สมบูรณ์',
      academicEnvironment:
          'เกิดจากการรวมกันของไวรัส 2 ชนิด (RTBV และ RTSV) ถ่ายทอดโดยมีแมลงพาหะคือ เพลี้ยจักจั่นสีเขียว (Nephotettix virescens) ระบาดหนักเมื่อมีประชากรเพลี้ยจักจั่นสูง',
      academicPrevention:
          '1. กำจัดแมลงพาหะ (เพลี้ยจักจั่นสีเขียว)\n2. ทำลายต้นข้าวที่เป็นโรคโดยการถอนและเผาทิ้ง\n3. ปลูกข้าวพร้อมกันในพื้นที่ขนาดใหญ่เพื่อลดการอพยพของแมลง\n4. พักนาเพื่อตัดวงจรชีวิตของแมลงพาหะ',

      recommendedChemicals: ['Buprofezin', 'Imidacloprid', 'Dinotefuran'],
      statProvinces: '8 จังหวัดเสี่ยง',
      statRegions: 'กำจัดเพลี้ยพาหะ',
    ),
    RiceDiseaseData(
      code: 'HEALTHY',
      name: 'ใบข้าวปกติ (Healthy Rice Leaf)',
      scientificName: 'Oryza sativa (Healthy)',
      category: 'ปกติ',
      riskLevel: 'ปลอดภัย',
      shortDescription: 'สีเขียวสม่ำเสมอ ใบตั้งตรง ไม่มีแผลหรือจุด — สัญญาณข้าวสุขภาพดี',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/0a/20201102.Hengnan.Hybrid_rice_Sanyou-1.6.jpg',

      // Farmer View
      farmerSymptoms: 'ใบข้าวสีเขียวสดใส แผ่นใบเรียบไม่มีแผล ไม่มีรอยกัดแทะ ต้นข้าวแข็งแรงกอใหญ่ ออกรวงดี',
      farmerPrevention: 'ดูแลระดับน้ำให้เหมาะสม ใส่ปุ๋ยตามค่าวิเคราะห์ดิน และหมั่นตรวจแปลงนาอย่างน้อยสัปดาห์ละ 1 ครั้ง',

      // Academic View
      academicSymptoms:
          'แผ่นใบมีความสมบูรณ์ สีเขียวสม่ำเสมอทั่วทั้งใบ ไม่ปรากฏร่องรอยของแผลช้ำน้ำ รอยไหม้ หรือจุดสีคล้ำ การสังเคราะห์แสงทำงานได้ 100%',
      academicEnvironment:
          'สภาพแวดล้อมมีความสมดุล ดินมีธาตุอาหารครบถ้วน (N-P-K และจุลธาตุ) การจัดการน้ำมีประสิทธิภาพ และไม่มีแมลงศัตรูพืชหรือเชื้อก่อโรคในระดับที่สร้างความเสียหาย',
      academicPrevention:
          '1. คงการจัดการแปลงนาตามหลัก GAP (Good Agricultural Practices)\n2. บำรุงรักษาความอุดมสมบูรณ์ของดิน\n3. ใช้ระบบนิเวศวิศวกรรม (Ecological Engineering) รักษาแมลงศัตรูธรรมชาติ',

      recommendedChemicals: ['ไม่ต้องใช้ยา', 'บำรุงปกติ'],
      statProvinces: 'สุขภาพดี',
      statRegions: 'นักวิจัยแนะนำ',
    ),
  ];
}
