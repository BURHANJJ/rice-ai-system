import 'package:flutter/material.dart';

class AuraBackground extends StatelessWidget {
  final Widget child;

  const AuraBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: double.infinity,
      color: const Color(0xFFFAF8F2),
      child: child,
    );
  }
}
