import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:remixicon/remixicon.dart';

import '../../models/diagnosis.dart';
import '../../models/rice_field.dart';
import '../../services/field_service.dart';
import '../fields/field_detail_screen.dart';
import '../fields/widgets/field_widgets.dart';
import '../../services/api_service.dart';
import '../../services/offline_classifier_stub.dart' if (dart.library.ffi) '../../services/offline_classifier.dart';
import 'package:http/http.dart' as http;
import '../../services/location_helper.dart';
import '../../services/navigation_provider.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import '../wiki/data/rice_department_data.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});
  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> with SingleTickerProviderStateMixin {
  XFile? _image;
  Position? _position;
  String? _locationNote;
  DiagnosisResult? _result;
  (RiceField, double)? _matchedField;
  bool _busy = false;
  String? _error;

  // AI Status
  bool _isAiOnline = true;
  String _aiAccuracy = 'กำลังตรวจสอบ...';
  bool _isPlaceholder = false;
  bool _onDevice = false;

  late AnimationController _scanController;
  Timer? _phaseTimer;
  int _phase = 0;
  static const _phases = ['กำลังอ่านภาพใบข้าว', 'ระบุตำแหน่งแปลงนา', 'AI กำลังวิเคราะห์โรค', 'กำลังบันทึกผล'];

  @override
  void initState() {
    super.initState();
    _scanController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _fetchAiStatus();
  }

  Future<void> _fetchAiStatus() async {
    if (!ApiService.hasServer) {
      // Beta build: the AI runs on this phone, same model and test accuracy as the server.
      setState(() {
        _isAiOnline = true;
        _isPlaceholder = false;
        _onDevice = true;
        _aiAccuracy = '97.9%';
      });
      return;
    }
    try {
      final res = await ApiService.instance.get('/ai-status');
      if (mounted) {
        setState(() {
          _isAiOnline = res['status'] == 'online';
          _aiAccuracy = res['accuracy'] ?? 'N/A';
          _isPlaceholder = res['is_placeholder'] ?? true;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isAiOnline = false;
          _aiAccuracy = 'N/A';
          _isPlaceholder = true;
        });
      }
    }
  }

  @override
  void dispose() {
    _phaseTimer?.cancel();
    _scanController.dispose();
    super.dispose();
  }

  int get _currentStep {
    if (_result != null) return 3;
    if (_image != null) return 2;
    return 1;
  }

  Future<void> _pickImage(ImageSource source) async {
    // Compress heavily to keep the Base64 string well under Firestore's 1MB limit
    final picked = await ImagePicker().pickImage(
      source: source,
      imageQuality: 60,
      maxWidth: 800,
      maxHeight: 800,
    );
    if (picked == null) return;
    HapticFeedback.selectionClick();
    setState(() {
      _image = picked;
      _result = null;
      _error = null;
    });
  }

  Future<void> _requestLocation() async {
    setState(() => _locationNote = null);
    try {
      final permission = await Geolocator.checkPermission();
      var granted = permission;
      if (permission == LocationPermission.denied) {
        granted = await Geolocator.requestPermission();
      }
      if (granted == LocationPermission.denied || granted == LocationPermission.deniedForever) {
        setState(() => _locationNote = 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง');
        return;
      }
      // A cold GPS fix without internet assistance can take minutes; fall back to the last fix.
      Position? pos;
      try {
        pos = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(timeLimit: Duration(seconds: 15)));
      } on TimeoutException {
        pos = await Geolocator.getLastKnownPosition();
      }
      if (pos == null) {
        setState(() => _locationNote = 'ยังหาตำแหน่งไม่ได้ ลองออกไปที่โล่งแล้วกดอีกครั้ง');
        return;
      }
      setState(() => _position = pos);

      final address = await LocationHelper.getThaiAddress(pos);
      setState(() => _locationNote = address);
    } catch (_) {
      setState(() => _locationNote = 'ไม่สามารถอ่านตำแหน่งได้ในขณะนี้');
    }
  }

  void _startPhases() {
    _phase = 0;
    _phaseTimer?.cancel();
    _phaseTimer = Timer.periodic(const Duration(milliseconds: 1400), (_) {
      if (mounted && _phase < _phases.length - 1) setState(() => _phase++);
    });
  }

  Future<void> _analyze() async {
    if (_image == null) {
      setState(() => _error = 'กรุณาเลือกภาพใบข้าวก่อน');
      _showError(_error!);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    _startPhases();
    try {
      // 0. Request location first so it's ready for the result screen
      await _requestLocation();

      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('กรุณาเข้าสู่ระบบก่อนใช้งาน (Firebase Auth required)');

      final bytes = await _image!.readAsBytes();

      // 1. Get AI Prediction from backend (backend no longer saves to SQLite).
      //    No signal in the field, or the AI server is down -> run the TFLite model on the phone.
      Map<String, dynamic> data;
      if (!ApiService.hasServer) {
        data = await OfflineClassifier.instance.diagnose(bytes);
        data['ai_warning'] = null;
        if (_position != null) {
          data['location'] = {
            'latitude': _position!.latitude,
            'longitude': _position!.longitude,
            'province': _provinceFromNote()
          };
        }
      } else {
        try {
          data = Map<String, dynamic>.from(await ApiService.instance.uploadImage(
            '/diagnosis/predict',
            bytes,
            _image!.name,
            latitude: _position?.latitude,
            longitude: _position?.longitude,
          ));
        } on Object catch (e) {
          final unreachable = e is SocketException ||
              e is TimeoutException ||
              e is http.ClientException ||
              (e is ApiException && (e.statusCode == 502 || e.statusCode == 503 || e.statusCode == 504));
          if (!unreachable || kIsWeb) rethrow;
          data = await OfflineClassifier.instance.diagnose(bytes);
          if (_position != null) {
            data['location'] = {
              'latitude': _position!.latitude,
              'longitude': _position!.longitude,
              'province': _provinceFromNote()
            };
          }
        }
      }

      // 2. Use compressed Base64 from backend to ensure it fits in Firestore's 1MB limit
      final base64Image = data['compressed_base64'] ?? base64Encode(bytes);

      // 3. Save to Firestore (Diagnoses collection)
      final diagData = {
        'user_id': user.uid,
        'disease_code': data['disease_code'],
        'disease_name': data['disease_name'],
        'confidence': data['confidence'],
        'diag_date': FieldValue.serverTimestamp(),
        'image_base64': base64Image, // Save the Base64 string directly
        'advice': data['advice'],
        'ai_source': data['ai_source'],
        'location': _position != null
            ? {
                'latitude': _position!.latitude,
                'longitude': _position!.longitude,
                'province': data['location']?['province'],
              }
            : null,
      };

      // Firestore applies the write locally at once and syncs when there's signal. Awaiting it
      // would wait for the server, which never answers in a field with no internet.
      final docRef = FirebaseFirestore.instance.collection('diagnoses').doc();
      unawaited(docRef.set(diagData).catchError((Object e) => debugPrint('diagnosis sync failed: $e')));

      // 4. Auto-create notification in Firestore
      final isDisease = data['disease_code'] != 'HEALTHY';
      final diseaseName = (data['disease_name'] as String? ?? '').replaceAll('โรคไหม้', 'โรคใบไหม้');
      unawaited(FirebaseFirestore.instance.collection('notifications').add({
        'user_id': user.uid,
        'type': isDisease ? 'disease_alert' : 'scan_result',
        'title': isDisease ? 'ตรวจพบ: $diseaseName' : 'ผลสแกน: ข้าวปกติ',
        'body': isDisease
            ? 'ระบบ AI ตรวจพบ$diseaseName ด้วยความมั่นใจ ${(data['confidence'] as num).toStringAsFixed(1)}% กรุณาเฝ้าระวังแปลงนาอย่างใกล้ชิด'
            : 'ระบบ AI วิเคราะห์ผลแล้ว ไม่พบสัญญาณของโรค ใบข้าวมีสุขภาพดี',
        'is_read': false,
        'diagnosis_id': docRef.id,
        'location': _locationNote,
        'created_at': FieldValue.serverTimestamp(),
      }).then((_) {}, onError: (Object e) => debugPrint('notification sync failed: $e')));

      // Inject doc ID so local model parses it
      data['diagnosis_id'] = docRef.id;
      HapticFeedback.heavyImpact();
      setState(() => _result = DiagnosisResult.fromJson(data));
      _matchField();
    } on ApiException catch (e) {
      setState(() => _error = e.message ?? 'วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่');
      _showError(_error!);
    } catch (e) {
      setState(() => _error = 'เกิดข้อผิดพลาด: $e');
      _showError(_error!);
    } finally {
      _phaseTimer?.cancel();
      setState(() => _busy = false);
    }
  }

  /// "ต.ท่าวังทอง อ.เมืองพะเยา จ.พะเยา" -> "พะเยา" (offline results have no server-side lookup).
  String? _provinceFromNote() => RegExp(r'จ\.(\S+)').firstMatch(_locationNote ?? '')?.group(1);

  Future<void> _saveWithGps() async {
    setState(() => _busy = true);
    try {
      await _requestLocation();

      if (_position != null && _result != null) {
        unawaited(FirebaseFirestore.instance.collection('diagnoses').doc(_result!.diagnosisId).update({
          'location': {
            'latitude': _position!.latitude,
            'longitude': _position!.longitude,
            'province': _locationNote ?? 'พิกัดปัจจุบัน',
            'address': _locationNote ?? 'พิกัดปัจจุบัน',
          }
        }).then((_) {}, onError: (Object e) => debugPrint('location sync failed: $e')));
      }

      if (!mounted) return;
      // Holds 2 seconds, then closes itself.
      await showAppSuccess(
        context,
        title: 'บันทึกสำเร็จ!',
        message: 'ข้อมูลและพิกัด GPS ถูกจัดเก็บลงฐานข้อมูลอย่างสมบูรณ์แบบ',
        mascot: RiceyMood.joy,
      );
      if (!mounted) return;
      _reset();
      context.read<NavigationProvider>().setIndex(0); // Switch to Home Tab
    } catch (e) {
      _showError('เกิดข้อผิดพลาด: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Links the scan to the farmer's field it was taken in (if they keep fields).
  Future<void> _matchField() async {
    _matchedField = null;
    if (_position == null) return;
    try {
      final m = await FieldService.nearestField(_position!.latitude, _position!.longitude);
      if (mounted && m != null) setState(() => _matchedField = m);
    } catch (_) {}
  }

  void _reset() {
    setState(() {
      _matchedField = null;
      _image = null;
      _result = null;
      _error = null;
    });
  }

  void _showError(String message) {
    if (mounted) AppToast.error(context, message, title: 'วิเคราะห์ไม่สำเร็จ');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Build
  // ───────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Scaffold(
      backgroundColor: p.bg,
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 450),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (c, a) => FadeTransition(
          opacity: a,
          child: SlideTransition(position: Tween(begin: const Offset(0, 0.04), end: Offset.zero).animate(a), child: c),
        ),
        child: _result != null
            ? KeyedSubtree(key: const ValueKey('result'), child: _buildResultScreen())
            : KeyedSubtree(key: const ValueKey('capture'), child: _buildCaptureScreen()),
      ),
    );
  }

  Widget _buildCaptureScreen() {
    final p = context.pal;
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 14, 20, 130),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text('สแกนใบข้าว', style: AppText.display(24, color: p.ink))),
              const SizedBox(width: 10),
              Flexible(child: _buildStatusBadge()),
            ],
          ),
          const SizedBox(height: 16),
          _buildStepper(),
          const SizedBox(height: 18),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 380),
            transitionBuilder: (c, a) => FadeTransition(
                opacity: a, child: ScaleTransition(scale: Tween(begin: 0.96, end: 1.0).animate(a), child: c)),
            child: _currentStep == 1
                ? Column(
                    key: const ValueKey('pick'),
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildCameraPlaceholder(),
                      const SizedBox(height: 14),
                      _buildActionButtons(),
                      const SizedBox(height: 14),
                      _buildTips(),
                      const SizedBox(height: 22),
                      _buildSupportedDiseases(),
                    ],
                  )
                : Column(
                    key: const ValueKey('preview'),
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildImagePreview(),
                      const SizedBox(height: 16),
                      _buildAnalyzeSection(),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepper() {
    final p = context.pal;
    const labels = ['เลือกภาพ', 'วิเคราะห์', 'ผลลัพธ์'];
    return Row(
      children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0)
            Expanded(
              child: Container(
                height: 2,
                margin: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(color: p.line, borderRadius: BorderRadius.circular(1)),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: _currentStep > i ? 1 : 0,
                  child: Container(color: p.primary),
                ),
              ),
            ),
          _buildStepItem(i + 1, labels[i]),
        ],
      ],
    );
  }

  Widget _buildStepItem(int stepNumber, String label) {
    final p = context.pal;
    final isActive = _currentStep >= stepNumber;
    final isDone = _currentStep > stepNumber;
    // On narrow phones only the current step keeps its label.
    final showLabel = _currentStep == stepNumber || MediaQuery.of(context).size.width >= 390;
    return Row(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: isActive ? p.primary : Colors.transparent,
            shape: BoxShape.circle,
            border: Border.all(color: isActive ? p.primary : p.line, width: 1.5),
          ),
          alignment: Alignment.center,
          child: isDone
              ? const Icon(Remix.check_line, size: 15, color: Colors.white)
              : Text(
                  '$stepNumber',
                  style:
                      TextStyle(color: isActive ? Colors.white : p.muted, fontWeight: FontWeight.w700, fontSize: 12.5),
                ),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 250),
          child: showLabel
              ? Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: _currentStep == stepNumber ? FontWeight.w700 : FontWeight.w500,
                      color: isActive ? p.primaryText : p.muted,
                    ),
                  ),
                )
              : const SizedBox.shrink(),
        ),
      ],
    );
  }

  Widget _buildStatusBadge() {
    final p = context.pal;
    final tone = _isAiOnline ? (_isPlaceholder ? Tone.warn : Tone.safe) : Tone.danger;
    final (fg, bg) = context.tone(tone);
    final label = _onDevice
        ? 'AI บนเครื่อง'
        : _isAiOnline
            ? (_isPlaceholder ? 'AI ทดสอบ (Mock)' : 'AI พร้อมใช้งาน')
            : 'AI ขัดข้อง';
    return Container(
      padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          PulseDot(color: fg, size: 6),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 12),
            ),
          ),
          if (_isAiOnline) ...[
            Container(
                width: 1, height: 12, margin: const EdgeInsets.symmetric(horizontal: 8), color: fg.withOpacity(0.3)),
            Text(_aiAccuracy, style: TextStyle(color: p.body, fontWeight: FontWeight.w600, fontSize: 12)),
          ],
        ],
      ),
    );
  }

  Widget _buildCameraPlaceholder() {
    return Semantics(
      button: true,
      label: 'ถ่ายภาพใบข้าว',
      child: Pressable(
        onTap: () => _pickImage(ImageSource.camera),
        scale: 0.985,
        child: Container(
          height: 290,
          decoration: BoxDecoration(color: AppColors.forestDeep, borderRadius: BorderRadius.circular(26)),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(26),
            child: Stack(
              fit: StackFit.expand,
              children: [
                CustomPaint(painter: CornerFramePainter(length: 34, stroke: 3.5, inset: 30)),
                AnimatedBuilder(
                  animation: _scanController,
                  builder: (_, __) => Align(
                    alignment: Alignment(0, -0.62 + 1.24 * Curves.easeInOut.transform(_scanController.value)),
                    child: Container(
                      height: 2,
                      margin: const EdgeInsets.symmetric(horizontal: 46),
                      decoration: BoxDecoration(
                        color: const Color(0xFF7BD389).withOpacity(0.85),
                        boxShadow: [
                          BoxShadow(color: const Color(0xFF7BD389).withOpacity(0.5), blurRadius: 12, spreadRadius: 1)
                        ],
                      ),
                    ),
                  ),
                ),
                const Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Remix.leaf_line, size: 54, color: Color(0xFFA7C4B0)),
                    SizedBox(height: 12),
                    Text('วางใบข้าวให้อยู่ในกรอบ',
                        style: TextStyle(color: Colors.white, fontSize: 15.5, fontWeight: FontWeight.w600)),
                    SizedBox(height: 2),
                    Text('แตะเพื่อเปิดกล้อง', style: TextStyle(color: Color(0xFFA7C4B0), fontSize: 12.5)),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Row(
      children: [
        Expanded(
          child:
              AppButton(label: 'ถ่ายภาพ', icon: Remix.camera_3_line, onPressed: () => _pickImage(ImageSource.camera)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: AppButton(
            label: 'คลังภาพ',
            icon: Remix.image_add_line,
            kind: ButtonKind.secondary,
            onPressed: () => _pickImage(ImageSource.gallery),
          ),
        ),
      ],
    );
  }

  Widget _buildTips() {
    final p = context.pal;
    const tips = [
      (Remix.sun_line, 'แสงสว่างพอ', Tone.warn),
      (Remix.focus_3_line, 'ใบเต็มกรอบ', Tone.primary),
      (Remix.search_eye_line, 'เห็นรอยโรค', Tone.info),
    ];
    return Row(
      children: [
        for (var i = 0; i < tips.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: p.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: p.line),
              ),
              child: Column(
                children: [
                  Icon(tips[i].$1, size: 18, color: context.tone(tips[i].$3).$1),
                  const SizedBox(height: 4),
                  Text(tips[i].$2, style: TextStyle(fontSize: 11.5, color: p.body, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildSupportedDiseases() {
    final p = context.pal;
    final diseases = [
      {'tone': Tone.danger, 'icon': Remix.fire_line, 'name': 'โรคใบไหม้', 'sci': 'Pyricularia oryzae'},
      {'tone': Tone.warn, 'icon': Remix.leaf_line, 'name': 'ขอบใบแห้ง', 'sci': 'Xanthomonas oryzae'},
      {'tone': Tone.info, 'icon': Remix.sun_line, 'name': 'ใบสีส้ม (Tungro)', 'sci': 'Rice Tungro Virus'},
      {'tone': Tone.safe, 'icon': Remix.checkbox_circle_line, 'name': 'ข้าวปกติ', 'sci': 'Healthy Rice'},
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(
          title: 'โรคที่ระบบรองรับ',
          trailing: StatusPill(label: '${diseases.length} ประเภท', tone: Tone.primary, dot: false),
        ),
        const SizedBox(height: 12),
        AppCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          child: Column(
            children: [
              for (var i = 0; i < diseases.length; i++) ...[
                if (i > 0) Divider(height: 1, color: p.line),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(
                    children: [
                      IconTile(icon: diseases[i]['icon'] as IconData, tone: diseases[i]['tone'] as Tone, size: 36),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(diseases[i]['name'] as String,
                                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.ink)),
                            Text(
                              diseases[i]['sci'] as String,
                              style: TextStyle(fontSize: 11.5, color: p.muted, fontStyle: FontStyle.italic),
                            ),
                          ],
                        ),
                      ),
                      Icon(Remix.check_line, size: 17, color: context.tone(diseases[i]['tone'] as Tone).$1),
                    ],
                  ),
                ),
              ],
              Divider(height: 1, color: p.line),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  children: [
                    Icon(Remix.information_line, size: 13, color: p.faint),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'ข้อมูลอ้างอิงจากกรมการข้าว ประเทศไทย • ความแม่นยำบนชุดทดสอบ $_aiAccuracy',
                        style: TextStyle(fontSize: 11.5, color: p.muted),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _imageWidget() =>
      kIsWeb ? Image.network(_image!.path, fit: BoxFit.cover) : Image.file(File(_image!.path), fit: BoxFit.cover);

  Widget _buildImagePreview() {
    return Container(
      height: 340,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.12), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          _imageWidget(),
          AnimatedOpacity(
            duration: const Duration(milliseconds: 300),
            opacity: _busy ? 1 : 0,
            child: Container(color: AppColors.forestDeep.withOpacity(0.45)),
          ),
          CustomPaint(painter: CornerFramePainter(length: 30, stroke: 3.5, inset: 18)),
          if (_busy)
            AnimatedBuilder(
              animation: _scanController,
              builder: (context, child) => Align(
                alignment: Alignment(0, -0.9 + 1.8 * _scanController.value),
                child: Container(
                  height: 3,
                  margin: const EdgeInsets.symmetric(horizontal: 18),
                  decoration: BoxDecoration(
                    color: const Color(0xFF7BD389),
                    boxShadow: [
                      BoxShadow(color: const Color(0xFF7BD389).withOpacity(0.8), blurRadius: 10, spreadRadius: 2),
                      BoxShadow(color: const Color(0xFF7BD389).withOpacity(0.35), blurRadius: 26, spreadRadius: 6),
                    ],
                  ),
                ),
              ),
            ),
          if (_busy)
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Container(
                padding: const EdgeInsets.fromLTRB(6, 4, 14, 4),
                decoration: BoxDecoration(
                  color: AppColors.forestDeep.withOpacity(0.85),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    const Ricey(mood: RiceyMood.scan, size: 46, interactive: false),
                    const SizedBox(width: 8),
                    Expanded(
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 300),
                        transitionBuilder: (c, a) => FadeTransition(
                          opacity: a,
                          child: SlideTransition(
                              position: Tween(begin: const Offset(0, 0.5), end: Offset.zero).animate(a), child: c),
                        ),
                        child: Text(
                          _phases[_phase],
                          key: ValueKey(_phase),
                          style: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                    Text('${_phase + 1}/${_phases.length}',
                        style: const TextStyle(color: Color(0xFFA7C4B0), fontSize: 12)),
                  ],
                ),
              ),
            ),
          if (!_busy)
            Positioned(
              top: 14,
              right: 14,
              child: Semantics(
                button: true,
                label: 'ลบภาพ',
                child: Pressable(
                  onTap: _reset,
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(color: Colors.black.withOpacity(0.5), shape: BoxShape.circle),
                    child: const Icon(Remix.close_line, color: Colors.white, size: 20),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildAnalyzeSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const RiceyTip(
          mood: RiceyMood.phone,
          size: 70,
          title: '$mascotNameแนะนำ',
          message: 'ภาพชัด แสงสว่าง ใบเต็มกรอบ ผลจะแม่นยำที่สุด',
        ),
        const SizedBox(height: 16),
        AppButton(
          label: 'เริ่มวิเคราะห์ด้วย AI',
          busyLabel: 'กำลังวิเคราะห์ผล...',
          icon: Remix.scan_2_line,
          busy: _busy,
          height: 58,
          onPressed: _analyze,
        ),
        const SizedBox(height: 10),
        AppButton(
          label: 'เลือกภาพใหม่',
          kind: ButtonKind.secondary,
          icon: Remix.image_edit_line,
          onPressed: _busy ? null : () => _pickImage(ImageSource.gallery),
        ),
      ],
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Result
  // ───────────────────────────────────────────────────────────────────────────

  Widget _buildResultScreen() {
    final p = context.pal;
    final isHealthy = _result!.diseaseCode == 'HEALTHY';
    final tone = isHealthy ? Tone.safe : Tone.danger;
    RiceDiseaseData? deptData;
    try {
      deptData = RiceDepartmentData.diseases.firstWhere((d) => d.code == _result!.diseaseCode);
    } catch (_) {}
    var i = 0;
    Widget step(Widget child) => FadeSlideIn.stagger(i++, child: child);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 12, 20, 130),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              AppBackButton(onPressed: _reset),
              const SizedBox(width: 12),
              Expanded(child: Text('ผลการวิเคราะห์', style: AppText.display(20, color: p.ink))),
            ],
          ),
          const SizedBox(height: 16),
          step(Container(
            height: 190,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(22)),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              fit: StackFit.expand,
              children: [
                _imageWidget(),
                Positioned(
                  left: 12,
                  top: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                    decoration: BoxDecoration(
                      color: isHealthy ? AppColors.safe : AppColors.danger,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(isHealthy ? Remix.leaf_fill : Remix.bug_fill, color: Colors.white, size: 13),
                        const SizedBox(width: 6),
                        Text(
                          isHealthy ? 'สุขภาพดี' : 'ตรวจพบโรค',
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          )),
          const SizedBox(height: 14),
          step(AppCard(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_result!.diseaseName, style: AppText.display(24, color: p.ink, height: 1.3)),
                      if (deptData != null)
                        Text(
                          deptData.scientificName,
                          style: TextStyle(fontSize: 12.5, color: p.muted, fontStyle: FontStyle.italic),
                        ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          StatusPill(label: isHealthy ? 'สุขภาพดี' : 'ตรวจพบโรค', tone: tone),
                          if (deptData != null && !isHealthy)
                            StatusPill(label: deptData.category, tone: Tone.neutral, dot: false),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                ConfidenceRing(percent: _result!.confidence, color: isHealthy ? p.safe : p.primary),
              ],
            ),
          )),
          const SizedBox(height: 10),
          step(RiceyTip(
            mood: isHealthy ? RiceyMood.guard : RiceyMood.worried,
            size: 72,
            tone: isHealthy ? p.safe : p.danger,
            title: isHealthy ? 'ข้าวแข็งแรงดี!' : 'พบ${_result!.diseaseName}',
            message: isHealthy
                ? 'ไม่พบสัญญาณโรค หมั่นสแกนทุกสัปดาห์เพื่อเฝ้าระวัง'
                : 'อย่าเพิ่งกังวล ดูวิธีจัดการด้านล่าง แล้วบันทึกผลเพื่อแจ้งเตือนเพื่อนบ้าน',
          )),
          if (_result!.aiSource == 'on-device-tflite') ...[
            const SizedBox(height: 10),
            step(Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                  color: p.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: p.line)),
              child: Row(children: [
                Icon(Remix.wifi_off_line, size: 18, color: p.muted),
                const SizedBox(width: 10),
                Expanded(
                    child: Text(_result!.aiWarning ?? 'วิเคราะห์บนเครื่อง (ออฟไลน์)',
                        style: TextStyle(color: p.muted, fontSize: 12.5, height: 1.5))),
              ]),
            )),
          ],
          const SizedBox(height: 14),
          step(_buildLocationCard()),
          if (!isHealthy) ...[
            const SizedBox(height: 14),
            step(_buildAdviceCard(deptData)),
          ],
          const SizedBox(height: 22),
          step(AppButton(
            label: 'บันทึกข้อมูล + GPS',
            busyLabel: 'กำลังบันทึกพิกัด...',
            icon: Remix.map_pin_add_line,
            busy: _busy,
            onPressed: _saveWithGps,
          )),
          const SizedBox(height: 10),
          step(AppButton(
            label: 'สแกนภาพใหม่',
            icon: Remix.camera_3_line,
            kind: ButtonKind.secondary,
            onPressed: _busy ? null : _reset,
          )),
        ],
      ),
    );
  }

  Widget _buildLocationCard() {
    final p = context.pal;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const IconTile(icon: Remix.map_pin_2_line, tone: Tone.warn, size: 36),
              const SizedBox(width: 10),
              Expanded(
                  child: Text('ตำแหน่งที่สแกน',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: p.ink))),
              _position != null
                  ? const StatusPill(label: 'GPS บันทึกแล้ว', tone: Tone.safe)
                  : const StatusPill(label: 'ไม่ได้ระบุ GPS', tone: Tone.neutral, dot: false),
            ],
          ),
          if (_matchedField != null) ...[
            const SizedBox(height: 12),
            Pressable(
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => FieldDetailScreen(fieldId: _matchedField!.$1.id)),
              ),
              child: Container(
                padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
                decoration: BoxDecoration(color: p.primarySoft, borderRadius: BorderRadius.circular(14)),
                child: Row(
                  children: [
                    FieldAvatar(field: _matchedField!.$1, size: 34),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('สแกนในแปลง ${_matchedField!.$1.name}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.primaryText)),
                          Text('ห่างจุดปักหมุดแปลง ${distanceLabel(_matchedField!.$2)} · ดูในสมุดแปลงนา',
                              style: TextStyle(fontSize: 11.5, color: p.muted)),
                        ],
                      ),
                    ),
                    Icon(Remix.arrow_right_s_line, color: p.primaryText),
                  ],
                ),
              ),
            ),
          ],
          if (_position != null) ...[
            const SizedBox(height: 14),
            Text(_locationNote ?? 'พิกัดปัจจุบัน', style: TextStyle(fontSize: 14, color: p.ink, height: 1.4)),
            const SizedBox(height: 4),
            Text(
              '${_position!.latitude.toStringAsFixed(4)}°N, ${_position!.longitude.toStringAsFixed(4)}°E',
              style: TextStyle(fontSize: 12.5, color: p.muted, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ],
          const SizedBox(height: 12),
          Divider(height: 1, color: p.line),
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(Remix.time_line, size: 13, color: p.faint),
              const SizedBox(width: 6),
              Text(
                'บันทึกเมื่อ ${DateFormat('dd/MM/yyyy HH:mm:ss').format(DateTime.now())}',
                style: TextStyle(fontSize: 12, color: p.muted),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAdviceCard(RiceDiseaseData? deptData) {
    final p = context.pal;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const IconTile(icon: Remix.stethoscope_line, tone: Tone.danger, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ข้อมูลและคำแนะนำ', style: AppText.display(17, color: p.ink)),
                    Text('อ้างอิงข้อมูลจากกรมการข้าว และ AI', style: TextStyle(fontSize: 12, color: p.muted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          _buildInfoSection(
            title: 'อาการที่พบเบื้องต้น',
            icon: Remix.search_eye_line,
            tone: Tone.warn,
            content: deptData?.farmerSymptoms ?? _result!.symptoms,
          ),
          const SizedBox(height: 16),
          Divider(height: 1, color: p.line),
          const SizedBox(height: 16),
          _buildInfoSection(
            title: 'วิธีแก้ไขและป้องกัน',
            icon: Remix.shield_check_line,
            tone: Tone.safe,
            content: deptData?.farmerPrevention ?? _result!.advice.map((a) => a.treatment).join('\n'),
          ),
          if (deptData != null && deptData.recommendedChemicals.isNotEmpty) ...[
            const SizedBox(height: 16),
            Divider(height: 1, color: p.line),
            const SizedBox(height: 16),
            ChemicalAdvice(chemicals: deptData.recommendedChemicals),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoSection(
      {required String title, required IconData icon, required Tone tone, required String content}) {
    if (content.isEmpty) return const SizedBox.shrink();
    final p = context.pal;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: context.tone(tone).$1),
            const SizedBox(width: 8),
            Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: p.ink)),
          ],
        ),
        const SizedBox(height: 8),
        Text(content, style: TextStyle(fontSize: 14, height: 1.65, color: p.body)),
      ],
    );
  }
}

/// Recommended chemicals with a safety notice; shared by the scan result
/// and the history detail.
class ChemicalAdvice extends StatelessWidget {
  const ChemicalAdvice({super.key, required this.chemicals});
  final List<String> chemicals;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Remix.flask_line, size: 18, color: p.info),
            const SizedBox(width: 8),
            Expanded(
              child: Text('การใช้ยาเคมี (กรณีระบาดรุนแรง)',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: p.ink)),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text('นำ "ชื่อสามัญ" ด้านล่างนี้ไปแจ้งร้านขายยาเกษตร:', style: TextStyle(fontSize: 13, color: p.muted)),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: chemicals
              .map((chem) => Pressable(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: chem));
                      AppToast.success(context, 'คัดลอก "$chem" แล้ว นำไปแสดงที่ร้านได้เลย', title: 'คัดลอกชื่อยาแล้ว');
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(color: p.infoSoft, borderRadius: BorderRadius.circular(12)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(chem, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.info)),
                          const SizedBox(width: 6),
                          Icon(Remix.file_copy_line, size: 13, color: p.info.withOpacity(0.7)),
                        ],
                      ),
                    ),
                  ))
              .toList(),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: p.dangerSoft, borderRadius: BorderRadius.circular(12)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Remix.error_warning_line, size: 16, color: p.danger),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'ข้อควรระวัง: โปรดปรึกษาร้านเคมีเกษตรก่อนใช้ และควรอ่านฉลากพร้อมผสมยาตามอัตราส่วนที่กำหนดอย่างเคร่งครัดเพื่อความปลอดภัย',
                  style: TextStyle(fontSize: 12.5, height: 1.5, color: p.danger),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
