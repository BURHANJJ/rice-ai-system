# TensorFlow Lite: the GPU delegate is optional and not bundled; keep the interpreter classes.
-dontwarn org.tensorflow.lite.gpu.**
-keep class org.tensorflow.lite.** { *; }
