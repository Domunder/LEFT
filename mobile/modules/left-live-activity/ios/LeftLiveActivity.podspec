Pod::Spec.new do |s|
  s.name           = 'LeftLiveActivity'
  s.version        = '1.0.0'
  s.summary        = "Starts, updates and ends LEFT's shared-budget Live Activity."
  s.description    = 'Screen 19. iOS 16.2+; a no-op everywhere else.'
  s.author         = ''
  s.homepage       = 'https://leftmoment.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
