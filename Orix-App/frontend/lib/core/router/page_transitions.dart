/// Page Transitions
///
/// Lightweight custom page transitions for smooth navigation.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Fast, smooth slide transition from right
class SlideTransitionPage<T> extends CustomTransitionPage<T> {
  SlideTransitionPage({
    required super.child,
    super.name,
    super.arguments,
    super.restorationId,
    super.key,
  }) : super(
         transitionDuration: const Duration(milliseconds: 200),
         reverseTransitionDuration: const Duration(milliseconds: 180),
         transitionsBuilder: (context, animation, secondaryAnimation, child) {
           final curvedAnimation = CurvedAnimation(
             parent: animation,
             curve: Curves.easeOutCubic,
             reverseCurve: Curves.easeInCubic,
           );

           return SlideTransition(
             position: Tween<Offset>(
               begin: const Offset(0.15, 0),
               end: Offset.zero,
             ).animate(curvedAnimation),
             child: FadeTransition(
               opacity: Tween<double>(begin: 0.0, end: 1.0).animate(
                 CurvedAnimation(
                   parent: animation,
                   curve: const Interval(0.0, 0.8),
                 ),
               ),
               child: child,
             ),
           );
         },
       );
}

/// Fade transition for dialogs and overlays
class FadeTransitionPage<T> extends CustomTransitionPage<T> {
  FadeTransitionPage({
    required super.child,
    super.name,
    super.arguments,
    super.restorationId,
    super.key,
  }) : super(
         transitionDuration: const Duration(milliseconds: 150),
         reverseTransitionDuration: const Duration(milliseconds: 120),
         transitionsBuilder: (context, animation, secondaryAnimation, child) {
           return FadeTransition(
             opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
             child: child,
           );
         },
       );
}

/// Scale + fade transition for important screens
class ScaleTransitionPage<T> extends CustomTransitionPage<T> {
  ScaleTransitionPage({
    required super.child,
    super.name,
    super.arguments,
    super.restorationId,
    super.key,
  }) : super(
         transitionDuration: const Duration(milliseconds: 220),
         reverseTransitionDuration: const Duration(milliseconds: 180),
         transitionsBuilder: (context, animation, secondaryAnimation, child) {
           final curvedAnimation = CurvedAnimation(
             parent: animation,
             curve: Curves.easeOutBack,
             reverseCurve: Curves.easeIn,
           );

           return ScaleTransition(
             scale: Tween<double>(
               begin: 0.94,
               end: 1.0,
             ).animate(curvedAnimation),
             child: FadeTransition(
               opacity: Tween<double>(begin: 0.0, end: 1.0).animate(
                 CurvedAnimation(
                   parent: animation,
                   curve: const Interval(0.0, 0.6),
                 ),
               ),
               child: child,
             ),
           );
         },
       );
}

/// Vertical slide for bottom sheets and modals
class SlideUpTransitionPage<T> extends CustomTransitionPage<T> {
  SlideUpTransitionPage({
    required super.child,
    super.name,
    super.arguments,
    super.restorationId,
    super.key,
  }) : super(
         transitionDuration: const Duration(milliseconds: 250),
         reverseTransitionDuration: const Duration(milliseconds: 200),
         transitionsBuilder: (context, animation, secondaryAnimation, child) {
           final curvedAnimation = CurvedAnimation(
             parent: animation,
             curve: Curves.easeOutCubic,
             reverseCurve: Curves.easeInCubic,
           );

           return SlideTransition(
             position: Tween<Offset>(
               begin: const Offset(0, 0.1),
               end: Offset.zero,
             ).animate(curvedAnimation),
             child: FadeTransition(opacity: curvedAnimation, child: child),
           );
         },
       );
}
