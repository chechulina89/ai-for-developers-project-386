import "@typespec/http";

using TypeSpec.Http;

@service(#{ title: "Meetly API" })
namespace Meetly;

model OwnerProfile {
  name: string;
  description: string;
  photoUrl: string;
}

union MeetingDuration {
  30,
  45,
  60,
}

model MeetingType {
  id: string;
  title: string;
  description: string;
  durationMinutes: MeetingDuration[];
  preparationInstructions?: string;
  onlineInstructions: string;
  priceKzt: int32;
  owner: OwnerProfile;
}

model MeetingTypesResponse {
  meetingTypes: MeetingType[];
}

model AvailabilitySlot {
  startAt: utcDateTime;
  endAt: utcDateTime;
}

model AvailabilityDate {
  date: string;
  slots: AvailabilitySlot[];
}

model AvailabilityResponse {
  timeZone: string;
  from: string;
  to: string;
  dates: AvailabilityDate[];
}

model GuestInput {
  name: string;
  phone: string;
}

model CreateBookingRequest {
  meetingTypeId: string;
  startAt: utcDateTime;
  durationMinutes: MeetingDuration;
  guest: GuestInput;
}

model BookingConfirmation {
  meetingTypeTitle: string;
  durationMinutes: MeetingDuration;
  startAt: utcDateTime;
  endAt: utcDateTime;
  ownerName: string;
  guestName: string;
  confirmationCode: string;
}

model BookingCreatedResponse {
  @statusCode _: 201;
  @body body: BookingConfirmation;
}

model OwnerLoginRequest {
  login: string;
  password: string;
}

model NoContentResponse {
  @statusCode _: 204;
  @header("Set-Cookie") setCookie?: string;
}

model OwnerBooking {
  meetingTypeTitle: string;
  startAt: utcDateTime;
  endAt: utcDateTime;
  guestName: string;
  guestPhone: string;
  confirmationCode: string;
}

model OwnerBookingsResponse {
  timeZone: string;
  bookings: OwnerBooking[];
}

model ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string>;
}

model ValidationErrorResponse {
  @statusCode _: 422;
  @body body: ApiError;
}

model AuthenticationErrorResponse {
  @statusCode _: 401;
  @body body: ApiError;
}

model ConflictErrorResponse {
  @statusCode _: 409;
  @body body: ApiError;
}

model RateLimitErrorResponse {
  @statusCode _: 429;
  @header("Retry-After") retryAfter: int32;
  @body body: ApiError;
}

@route("/api/meeting-types")
@get
op getMeetingTypes(): MeetingTypesResponse;

@route("/api/meeting-types/{meetingTypeId}/availability")
@get
op getAvailability(
  @path meetingTypeId: string,
  @query from: string,
  @query to: string,
  @query durationMinutes: MeetingDuration,
): AvailabilityResponse | ValidationErrorResponse;

@route("/api/bookings")
@post
op createBooking(
  @header("Idempotency-Key") idempotencyKey: string,
  @body request: CreateBookingRequest,
): BookingCreatedResponse
  | ValidationErrorResponse
  | ConflictErrorResponse;

@route("/api/owner/session")
@post
op createOwnerSession(
  @body request: OwnerLoginRequest,
): NoContentResponse | AuthenticationErrorResponse | RateLimitErrorResponse;

@route("/api/owner/session")
@delete
op deleteOwnerSession(): NoContentResponse;

@route("/api/owner/bookings")
@get
op getOwnerBookings(): OwnerBookingsResponse | AuthenticationErrorResponse;

@route("/health")
@get
op getHealth(): { status: "ok" };
