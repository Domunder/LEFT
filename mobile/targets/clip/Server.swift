import Foundation

/*
  The clip's side of the server — the same doors the app and the web camera
  use (`mobile/src/lib/{auth,events,photos,storage}.ts`,
  `web/src/shoot/api.ts`). Keep the three in step when a door changes.

  Plain HTTPS, no Supabase SDK: the clip has to stay small, and it needs six
  calls. A clip guest is an anonymous Supabase user exactly like an app or a
  browser guest; the roll, the group cap and the reveal are enforced by the
  database, so the clip cannot do anything the app could not. Missions
  (2026-11-18) add four RPCs and the guest's own photos for Your shots.
*/

struct Session: Codable, Equatable {
  var accessToken: String
  var refreshToken: String
  /// Unix seconds.
  var expiresAt: Double
  var userId: String

  enum CodingKeys: String, CodingKey {
    case accessToken = "access_token"
    case refreshToken = "refresh_token"
    case expiresAt = "expires_at"
    case userId = "user_id"
  }
}

/// The session lives in the App Group, which is also the hand-off: the full
/// app adopts it on its first launch (`lib/clip-handoff.ts`) and deletes it.
enum SessionStore {
  static func load() -> Session? {
    guard let json = ClipConfig.shared.string(forKey: ClipConfig.handoffKey),
          let data = json.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(Session.self, from: data)
  }

  static func save(_ session: Session?) {
    guard let session, let data = try? JSONEncoder().encode(session),
          let json = String(data: data, encoding: .utf8)
    else {
      ClipConfig.shared.removeObject(forKey: ClipConfig.handoffKey)
      return
    }
    // A string, because that is what ExtensionStorage.get() reads.
    ClipConfig.shared.set(json, forKey: ClipConfig.handoffKey)
  }
}

enum EventStatus: String, Decodable {
  case setup, live, developed
}

struct EventInfo: Decodable, Equatable {
  let id: String
  let name: String
  let look: FilmLook
  let status: EventStatus
  let endsAt: Date
  /// nil is the unlimited roll.
  let rollSize: Int?

  enum CodingKeys: String, CodingKey {
    case id, name, look, status
    case endsAt = "ends_at"
    case rollSize = "roll_size"
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    name = try c.decode(String.self, forKey: .name)
    look = FilmLook(rawValue: try c.decode(String.self, forKey: .look)) ?? .fallback
    status = try c.decode(EventStatus.self, forKey: .status)
    let raw = try c.decode(String.self, forKey: .endsAt)
    guard let date = parseTimestamp(raw) else {
      throw DecodingError.dataCorruptedError(forKey: .endsAt, in: c, debugDescription: "Bad timestamp \(raw)")
    }
    endsAt = date
    rollSize = try c.decodeIfPresent(Int.self, forKey: .rollSize)
  }

  /// As `is_event_developed()` decides it: by status or by the clock.
  func isDeveloped(now: Date = Date()) -> Bool {
    status == .developed || endsAt <= now
  }
}

struct MemberInfo: Decodable {
  let displayName: String
  let shotsTaken: Int

  enum CodingKeys: String, CodingKey {
    case displayName = "display_name"
    case shotsTaken = "shots_taken"
  }
}

/// What a guest was dealt (`my_missions()`). `photoId`: the photo that fulfils it.
struct Mission: Decodable, Identifiable, Equatable {
  let id: String
  let body: String
  let personal: Bool
  var photoId: String?

  enum CodingKeys: String, CodingKey {
    case id = "mission_id"
    case body, personal
    case photoId = "photo_id"
  }
}

/// A name the host listed for personal missions that nobody has claimed yet.
struct MissionName: Decodable, Identifiable, Equatable {
  let id: String
  let name: String

  enum CodingKeys: String, CodingKey {
    case id = "person_id"
    case name
  }
}

/// One of the guest's own uploaded photos (RLS: only their own before the reveal).
struct OwnPhoto: Decodable {
  let id: String
  let storagePath: String?
  let thumbPath: String?
  let takenAt: String

  enum CodingKeys: String, CodingKey {
    case id
    case storagePath = "storage_path"
    case thumbPath = "thumb_path"
    case takenAt = "taken_at"
  }
}

enum ClipError: LocalizedError, Equatable {
  case notConfigured
  case rollEmpty
  case eventClosed
  case missionNameTaken
  case server(status: Int, code: String?, hint: String?, message: String)

  var hint: String? {
    if case let .server(_, _, hint, _) = self { return hint }
    return nil
  }

  var code: String? {
    if case let .server(_, code, _, _) = self { return code }
    return nil
  }

  /// The server refuses this tag for good: developed, not the guest's, no such
  /// photo. Mirrors `tagRefusedForGood()` in `web/src/shoot/api.ts`.
  var tagRefusedForGood: Bool {
    hint == "event_closed" || hint == "not_yours" || code == "P0002"
  }

  var errorDescription: String? { messageFor(self) }
}

/// A sentence for any failure. Mirrors `messageFor()` in `web/src/shoot/api.ts`.
func messageFor(_ error: Error) -> String {
  if let clip = error as? ClipError {
    switch clip {
    case .notConfigured: return "The camera isn’t set up yet."
    case .rollEmpty: return "Your roll is used up."
    case .eventClosed: return "The cameras aren’t open."
    case .missionNameTaken: return "Someone else just took that name. Pick another, or none."
    case let .server(_, code, hint, message):
      if hint == "full" { return "This group is full. Ask the host to make room." }
      if code == "P0002" { return "This invite link doesn’t work any more. Ask the host for a new one." }
      if message.localizedCaseInsensitiveContains("anonymous") { return "Joining isn’t available right now." }
      return message.isEmpty ? "Something went wrong. Try again." : message
    }
  }
  if error is URLError { return "No connection. Check your signal and try again." }
  return "Something went wrong. Try again."
}

/// Postgres timestamps: `2026-11-16T21:00:00.123456+00:00`. Foundation's ISO
/// parser does not take six fractional digits, so the fraction is added by hand.
func parseTimestamp(_ raw: String) -> Date? {
  var text = raw.replacingOccurrences(of: " ", with: "T")
  var fraction = 0.0
  if let dot = text.firstIndex(of: ".") {
    let digitsEnd = text[dot...].dropFirst().firstIndex(where: { !$0.isNumber }) ?? text.endIndex
    fraction = Double("0" + text[dot..<digitsEnd]) ?? 0
    text.removeSubrange(dot..<digitsEnd)
  }
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime]
  return formatter.date(from: text).map { $0.addingTimeInterval(fraction) }
}

func timestampString(_ date: Date) -> String {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return formatter.string(from: date)
}

actor Server {
  static let shared = Server()

  private var session: Session? = SessionStore.load()
  private var refreshing: Task<Session, Error>?
  private let http: URLSession = {
    let config = URLSessionConfiguration.default
    config.timeoutIntervalForRequest = 30
    config.waitsForConnectivity = false
    return URLSession(configuration: config)
  }()

  var userId: String? { session?.userId }

  // MARK: Auth

  /// The signed-in user's id, signing in anonymously first if there is nobody.
  /// Idempotent: a second identity would orphan the guest's roll.
  func ensureGuest() async throws -> String {
    if let session { return session.userId }
    let data = try await send("auth/v1/signup", method: "POST", json: ["data": [String: String]()], auth: false)
    let fresh = try Self.parseSession(data)
    adopt(fresh)
    return fresh.userId
  }

  /// `setDisplayName()`: the name on the account, as the app's 11 writes it.
  func setDisplayName(_ name: String) async throws {
    _ = try await send("auth/v1/user", method: "PUT", json: ["data": ["name": name]])
  }

  private func adopt(_ fresh: Session?) {
    session = fresh
    SessionStore.save(fresh)
  }

  private func accessToken() async throws -> String {
    guard let current = session else { throw ClipError.server(status: 401, code: nil, hint: nil, message: "Not signed in") }
    if current.expiresAt - 60 > Date().timeIntervalSince1970 { return current.accessToken }
    return try await refresh().accessToken
  }

  private func refresh() async throws -> Session {
    if let refreshing { return try await refreshing.value }
    // The full app may have adopted (and rotated) the session since this
    // clip last ran: always refresh with the latest copy in the App Group.
    guard let current = SessionStore.load() ?? session else {
      throw ClipError.server(status: 401, code: nil, hint: nil, message: "Not signed in")
    }
    let task = Task { () throws -> Session in
      let data = try await self.send(
        "auth/v1/token?grant_type=refresh_token",
        method: "POST",
        json: ["refresh_token": current.refreshToken],
        auth: false
      )
      return try Self.parseSession(data)
    }
    refreshing = task
    defer { refreshing = nil }
    do {
      let fresh = try await task.value
      adopt(fresh)
      return fresh
    } catch let ClipError.server(status, _, _, _) where (400..<500).contains(status) {
      // The refresh token is gone (revoked, or used by the full app). This
      // identity cannot come back; the next join starts a new one.
      adopt(nil)
      throw ClipError.server(status: 401, code: nil, hint: nil, message: "Your session ended. Open the invite again.")
    }
  }

  private static func parseSession(_ data: Data) throws -> Session {
    struct Raw: Decodable {
      struct User: Decodable { let id: String }
      let access_token: String
      let refresh_token: String
      let expires_in: Double?
      let expires_at: Double?
      let user: User
    }
    let raw = try JSONDecoder().decode(Raw.self, from: data)
    return Session(
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      expiresAt: raw.expires_at ?? Date().timeIntervalSince1970 + (raw.expires_in ?? 3600),
      userId: raw.user.id
    )
  }

  // MARK: Events

  func joinEvent(code: String, name: String) async throws -> String {
    let data = try await send("rest/v1/rpc/join_event", method: "POST", json: [
      "p_invite_code": code,
      "p_display_name": name,
    ])
    return try JSONDecoder().decode(String.self, from: data)
  }

  func getEvent(_ id: String) async throws -> EventInfo {
    let data = try await send("rest/v1/events?id=eq.\(id)&select=id,name,look,status,ends_at,roll_size")
    guard let event = try JSONDecoder().decode([EventInfo].self, from: data).first else {
      throw ClipError.server(status: 404, code: "P0002", hint: nil, message: "No such event")
    }
    return event
  }

  /// The caller's roster row, or nil when they are not a member.
  func getMyMember(eventId: String) async throws -> MemberInfo? {
    guard let userId = session?.userId else { return nil }
    let data = try await send(
      "rest/v1/event_members?event_id=eq.\(eventId)&user_id=eq.\(userId)&select=display_name,shots_taken"
    )
    return try JSONDecoder().decode([MemberInfo].self, from: data).first
  }

  // MARK: Photos

  /// Spend one frame. Idempotent per `photoId`; anything but the two refusals
  /// is retryable. Returns `shots_left` (nil is the unlimited roll).
  func claimShot(eventId: String, photoId: String, takenAt: String) async throws -> Int? {
    let data: Data
    do {
      data = try await send("rest/v1/rpc/claim_shot", method: "POST", json: [
        "p_event_id": eventId,
        "p_photo_id": photoId,
        "p_taken_at": takenAt,
      ])
    } catch let error as ClipError {
      if error.hint == "roll_empty" { throw ClipError.rollEmpty }
      if error.hint == "event_closed" { throw ClipError.eventClosed }
      throw error
    }
    struct Row: Decodable { let shots_left: Int? }
    guard let row = try JSONDecoder().decode([Row].self, from: data).first else {
      throw ClipError.server(status: 500, code: nil, hint: nil, message: "The shot was not recorded")
    }
    return row.shots_left
  }

  /// `{event}/{user}/{photo}.jpg` and `…_thumb.jpg` — the only names the
  /// bucket's insert policy accepts.
  static func photoPath(eventId: String, userId: String, photoId: String, thumb: Bool) -> String {
    "\(eventId)/\(userId)/\(photoId)\(thumb ? "_thumb" : "").jpg"
  }

  func upload(path: String, jpeg: Data) async throws {
    _ = try await send(
      "storage/v1/object/\(ClipConfig.bucket)/\(path)",
      method: "POST",
      body: jpeg,
      contentType: "image/jpeg",
      headers: ["x-upsert": "true"]
    )
  }

  func markPhotoUploaded(photoId: String, width: Int, height: Int) async throws {
    _ = try await send("rest/v1/rpc/mark_photo_uploaded", method: "POST", json: [
      "p_photo_id": photoId,
      "p_width": width,
      "p_height": height,
    ])
  }

  /// The guest's uploaded photos in this event, oldest first.
  func myPhotos(eventId: String) async throws -> [OwnPhoto] {
    guard let userId = session?.userId else { return [] }
    let data = try await send(
      "rest/v1/photos?event_id=eq.\(eventId)&user_id=eq.\(userId)&status=eq.uploaded" +
        "&select=id,storage_path,thumb_path,taken_at&order=taken_at"
    )
    return try JSONDecoder().decode([OwnPhoto].self, from: data)
  }

  /// `path -> URL`, valid for an hour. The bucket's select policy decides
  /// what may be signed (before the reveal: the guest's own files).
  func signedURLs(_ paths: [String]) async throws -> [String: URL] {
    guard !paths.isEmpty, let base = ClipConfig.supabaseURL else { return [:] }
    let data = try await send("storage/v1/object/sign/\(ClipConfig.bucket)", method: "POST", json: [
      "expiresIn": 3600,
      "paths": paths,
    ])
    struct Row: Decodable { let path: String?; let signedURL: String? }
    var urls: [String: URL] = [:]
    for row in try JSONDecoder().decode([Row].self, from: data) {
      // `signedURL` is relative to the storage API: "/object/sign/…?token=…".
      if let path = row.path, let relative = row.signedURL,
         let url = URL(string: base.absoluteString + "/storage/v1" + relative) {
        urls[path] = url
      }
    }
    return urls
  }

  // MARK: Missions — mirrors the guest half of `mobile/src/lib/missions.ts`

  /// The guest's missions. The first call while the event is live deals them; empty when off.
  func myMissions(eventId: String) async throws -> [Mission] {
    let data = try await send("rest/v1/rpc/my_missions", method: "POST", json: ["p_event_id": eventId])
    return try JSONDecoder().decode([Mission].self, from: data)
  }

  /// "This photo was for that mission"; nil: for none. Needs the photo's row (after the claim).
  func setPhotoMission(photoId: String, missionId: String?) async throws {
    var body: [String: Any] = ["p_photo_id": photoId]
    if let missionId { body["p_mission_id"] = missionId }
    _ = try await send("rest/v1/rpc/set_photo_mission", method: "POST", json: body)
  }

  /// The names the host listed for personal missions that nobody has claimed yet.
  func missionNames(code: String) async throws -> [MissionName] {
    let data = try await send("rest/v1/rpc/mission_people_for_invite", method: "POST", json: ["p_invite_code": code])
    return try JSONDecoder().decode([MissionName].self, from: data)
  }

  /// "That's me." Refused with `taken`; `already_dealt` is ignored, as in the app.
  func claimMissionName(eventId: String, personId: String) async throws {
    do {
      _ = try await send("rest/v1/rpc/claim_mission_person", method: "POST", json: [
        "p_event_id": eventId,
        "p_person_id": personId,
      ])
    } catch let error as ClipError {
      if error.hint == "taken" { throw ClipError.missionNameTaken }
      if error.hint == "already_dealt" { return }
      throw error
    }
  }

  // MARK: Transport

  private func send(
    _ path: String,
    method: String = "GET",
    json: Any? = nil,
    body: Data? = nil,
    contentType: String? = nil,
    headers: [String: String] = [:],
    auth: Bool = true,
    retried: Bool = false
  ) async throws -> Data {
    guard let base = ClipConfig.supabaseURL, let key = ClipConfig.supabaseKey,
          let url = URL(string: base.absoluteString + "/" + path)
    else { throw ClipError.notConfigured }

    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue(key, forHTTPHeaderField: "apikey")
    var bearer = key
    if auth { bearer = try await accessToken() }
    request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
    if let json {
      request.httpBody = try JSONSerialization.data(withJSONObject: json)
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    } else if let body {
      request.httpBody = body
      request.setValue(contentType ?? "application/octet-stream", forHTTPHeaderField: "Content-Type")
    }
    for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }

    let (data, response) = try await http.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    if (200..<300).contains(status) { return data }

    // An expired token the clock did not predict: refresh once and repeat.
    if status == 401, auth, !retried, session != nil {
      _ = try await refresh()
      return try await send(path, method: method, json: json, body: body, contentType: contentType,
                            headers: headers, auth: auth, retried: true)
    }
    throw Self.failure(status: status, data: data)
  }

  /// PostgREST says `{code, hint, message}`, GoTrue `{error_code, msg}`,
  /// storage `{error, message}`. Supabase errors are never `Error` objects on
  /// the wire either — read them all into one shape.
  private static func failure(status: Int, data: Data) -> ClipError {
    let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    let message = (object["message"] ?? object["msg"] ?? object["error_description"] ?? object["error"]) as? String
    return .server(
      status: status,
      code: (object["code"] ?? object["error_code"]).map { "\($0)" },
      hint: object["hint"] as? String,
      message: message ?? HTTPURLResponse.localizedString(forStatusCode: status)
    )
  }
}
