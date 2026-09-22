-- Minimal test schema only; no production rows. Does not model all Supabase triggers.

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "role" "text" DEFAULT 'user'::"text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "accepted_terms" boolean DEFAULT false,
    "accepted_terms_at" timestamp with time zone,
    "push_token" "text",
    "birth_date" "date",
    "gender" "text",
    "nationality" "text",
    "deleted_at" timestamp with time zone,
    "age_confirmed" boolean DEFAULT false NOT NULL,
    "accepted_terms_version" "text",
    "is_admin" boolean DEFAULT false NOT NULL,
    "email_verified_at" timestamp with time zone,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'coach'::"text"])))
);

alter table profiles add primary key(id); alter table profiles enable row level security;

CREATE TABLE IF NOT EXISTS "public"."coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "specialty" "text",
    "bio" "text",
    "price_per_session" numeric,
    "nationality" "text",
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "application_video_url" "text",
    "video_url" "text",
    "instant_booking" boolean DEFAULT false NOT NULL,
    "availability_status" "text" DEFAULT 'activo'::"text" NOT NULL,
    "mp_connected" boolean DEFAULT false NOT NULL,
    "application_status" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "application_notes" "text",
    "application_reviewed_at" timestamp with time zone,
    "accepts_international" boolean DEFAULT false NOT NULL,
    "price_usd" integer,
    "accepts_paypal" boolean DEFAULT false NOT NULL,
    "accepts_usdt" boolean DEFAULT false NOT NULL,
    "has_matricula" boolean DEFAULT false NOT NULL,
    "slug" "text" NOT NULL,
    CONSTRAINT "coaches_application_status_check" CHECK (("application_status" = ANY (ARRAY['pendiente'::"text", 'aprobada'::"text", 'rechazada'::"text"]))),
    CONSTRAINT "coaches_availability_status_check" CHECK (("availability_status" = ANY (ARRAY['activo'::"text", 'en_pausa'::"text"]))),
    CONSTRAINT "coaches_price_usd_check" CHECK ((("price_usd" IS NULL) OR (("price_usd" >= 20) AND ("price_usd" <= 10000))))
);

alter table coaches add primary key(id); alter table coaches enable row level security;

CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "coach_id" "uuid",
    "coach_name" "text" NOT NULL,
    "coach_specialty" "text" DEFAULT ''::"text" NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "scheduled_time" "text" NOT NULL,
    "amount" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "room_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sala_id" "uuid",
    "user_message" "text",
    "cancelled_by" "text",
    "cancelled_late" boolean,
    "duration_minutes" integer,
    "meeting_url" "text",
    "currency" "text" DEFAULT 'ARS'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'no_iniciado'::"text" NOT NULL,
    "payment_id" "text",
    "preference_id" "text",
    "platform_fee_pct" numeric DEFAULT 20 NOT NULL,
    "paid_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    "refund_attempts" smallint DEFAULT 0 NOT NULL,
    "payment_provider" "text" DEFAULT 'mp'::"text" NOT NULL,
    "usdt_amount" numeric(18,6),
    "refund_address" "text",
    "refund_network" "text",
    "refund_tx_id" "text",
    "paid_out_at" timestamp with time zone,
    "payout_reference" "text",
    "charged_amount" numeric(12,2),
    "disputed_at" timestamp with time zone,
    "dispute_reason" "text",
    "user_tz_observed" "text",
    "user_observation_source" "text",
    "user_observed_at" timestamp with time zone,
    "dispute_resolved_at" timestamp with time zone,
    "dispute_outcome" "text",
    "payer_fingerprint" "text",
    "origen" "text",
    CONSTRAINT "bookings_observation_source_check" CHECK ((("user_observation_source" IS NULL) OR ("user_observation_source" = ANY (ARRAY['timezone'::"text", 'declarado'::"text", 'ip'::"text"])))),
    CONSTRAINT "bookings_origen_check" CHECK ((("origen" IS NULL) OR ("origen" = ANY (ARRAY['link'::"text", 'app'::"text", 'catalogo'::"text"])))),
    CONSTRAINT "bookings_payment_provider_check" CHECK (("payment_provider" = ANY (ARRAY['mp'::"text", 'paypal'::"text", 'usdt'::"text"]))),
    CONSTRAINT "bookings_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['no_iniciado'::"text", 'pendiente'::"text", 'aprobado'::"text", 'rechazado'::"text", 'reembolso_pendiente'::"text", 'reembolsado'::"text", 'contracargo'::"text"]))),
    CONSTRAINT "bookings_refund_address_check" CHECK ((("refund_address" IS NULL) OR (("refund_network" = 'TRC20'::"text") AND ("refund_address" ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'::"text")) OR (("refund_network" = ANY (ARRAY['ERC20'::"text", 'POLYGON'::"text"])) AND ("refund_address" ~ '^0x[0-9a-fA-F]{40}$'::"text")))),
    CONSTRAINT "bookings_refund_network_check" CHECK ((("refund_network" IS NULL) OR ("refund_network" = ANY (ARRAY['TRC20'::"text", 'ERC20'::"text", 'POLYGON'::"text"])))),
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'confirmada'::"text", 'completada'::"text", 'cancelada'::"text"])))
);

alter table bookings add primary key(id); alter table bookings enable row level security;

CREATE TABLE IF NOT EXISTS "public"."coach_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "format" "text" NOT NULL,
    "source" "text" NOT NULL,
    "url" "text",
    "storage_path" "text",
    "body_md" "text",
    "topic_id" "text" NOT NULL,
    "duration_seconds" integer,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "rejection_rule" smallint,
    "is_author_declared" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "wellness_goal" "text",
    CONSTRAINT "coach_resources_format_check" CHECK (("format" = ANY (ARRAY['audio'::"text", 'podcast'::"text", 'video'::"text", 'lectura'::"text"]))),
    CONSTRAINT "coach_resources_rejection_rule_check" CHECK ((("rejection_rule" >= 1) AND ("rejection_rule" <= 6))),
    CONSTRAINT "coach_resources_source_check" CHECK (("source" = ANY (ARRAY['native'::"text", 'external'::"text"]))),
    CONSTRAINT "coach_resources_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'published'::"text", 'rejected'::"text", 'archived'::"text"]))),
    CONSTRAINT "coach_resources_wellness_goal_check" CHECK (("wellness_goal" = ANY (ARRAY['calmar_ansiedad'::"text", 'dormir_mejor'::"text", 'mejorar_animo'::"text", 'ganar_foco'::"text", 'construir_habitos'::"text", 'entender_emociones'::"text", 'mover_el_cuerpo'::"text", 'alimentacion'::"text"])))
);

alter table coach_resources add primary key(id); alter table coach_resources enable row level security;

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "booking_id" "uuid",
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "emailed_at" timestamp with time zone,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['reserva_nueva'::"text", 'reserva_confirmada'::"text", 'reserva_rechazada'::"text", 'reserva_cancelada'::"text", 'recordatorio_sesion'::"text", 'invitacion_review'::"text", 'recurso_feedback_umbral'::"text", 'propuesta_publicada'::"text", 'propuesta_ajustes'::"text", 'postulacion_aprobada'::"text", 'postulacion_rechazada'::"text", 'credencial_verificada'::"text", 'credencial_rechazada'::"text", 'recurso_publicado'::"text", 'recurso_rechazado'::"text"])))
);

alter table notifications add primary key(id); alter table notifications enable row level security;

CREATE TABLE IF NOT EXISTS "public"."salas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "coach_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "room_url" "text",
    "user_last_read_at" timestamp with time zone,
    "coach_last_read_at" timestamp with time zone,
    "coach_archived" boolean
);

alter table salas add primary key(id); alter table salas enable row level security;

CREATE POLICY "Perfiles de coaches visibles para todos" ON "public"."profiles" FOR SELECT USING ((("role" = 'coach'::"text") OR ("auth"."uid"() = "id")));

CREATE POLICY "Coaches are viewable by everyone" ON "public"."coaches" FOR SELECT USING (true);

CREATE POLICY "bookings_insert_own" ON "public"."bookings" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "bookings_select_own" ON "public"."bookings" FOR SELECT USING (("user_id" = "auth"."uid"()));

CREATE POLICY "users_cancel_own_booking" ON "public"."bookings" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['pendiente'::"text", 'confirmada'::"text"])))) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("status" = 'cancelada'::"text")));

CREATE POLICY "coach_resources_insert" ON "public"."coach_resources" FOR INSERT WITH CHECK ((("coach_id" IN ( SELECT "coaches"."id"
   FROM "public"."coaches"
  WHERE ("coaches"."profile_id" = "auth"."uid"()))) AND ("is_author_declared" = true)));

CREATE POLICY "coach_resources_select" ON "public"."coach_resources" FOR SELECT USING ((("status" = 'published'::"text") OR ("coach_id" IN ( SELECT "coaches"."id"
   FROM "public"."coaches"
  WHERE ("coaches"."profile_id" = "auth"."uid"())))));

CREATE POLICY "coach_resources_update" ON "public"."coach_resources" FOR UPDATE USING (("coach_id" IN ( SELECT "coaches"."id"
   FROM "public"."coaches"
  WHERE ("coaches"."profile_id" = "auth"."uid"())))) WITH CHECK (("coach_id" IN ( SELECT "coaches"."id"
   FROM "public"."coaches"
  WHERE ("coaches"."profile_id" = "auth"."uid"()))));
