//
//  The widget extension's entry point.
//
//  A widget extension is launched by WidgetKit, not by the app, and `@main` on a
//  `WidgetBundle` is how it declares what it can draw. This bundle holds only the
//  Live Activity — LEFT ships no home-screen widget, and adding one later means
//  adding it to this list rather than adding another target.
//
//  Gated at iOS 16.2: Live Activities landed in 16.1 but `ActivityContent` and
//  `staleDate` — which the app side uses — arrived in 16.2, so that is the floor
//  the whole feature is built against.
//

import SwiftUI
import WidgetKit

@main
struct LeftBudgetWidgetBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 16.2, *) {
            LeftBudgetLiveActivity()
        }
    }
}
