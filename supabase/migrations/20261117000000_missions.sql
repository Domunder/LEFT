-- Missions (2026-11-17).
--
-- A host can switch on small challenges for the evening: every guest is dealt a
-- few "missions" (a photo with someone you don't know, …) and marks which photo
-- fulfils which. The album then shows the mission under the photo.
--
-- The model is the smallest that works:
--
--   events.missions_per_guest   NULL = off, 1..3 = how many each guest is dealt.
--   event_missions              the event's list. The host can rewrite it until
--                               the event starts. A row with a person_id is a
--                               *personal* mission, for one named guest.
--   mission_people              names the host listed ("Tom"). A guest picks
--                               theirs when joining; each name is claimed once.
--   member_missions             what a guest was dealt, and which of their
--                               photos fulfils it (photo_id).
--
-- Three rules carry over from the roll and the reveal:
--
--   * The deal is the server's. my_missions() deals once, under the member row's
--     lock, and never again — a guest cannot reroll.
--   * A photo is tagged through set_photo_mission(), never by writing a row.
--   * The reveal holds: until the film is developed a member sees only their own
--     missions and which of their own photos they went with. Nothing links
--     somebody else's photo to a mission early.

-- ---------------------------------------------------------------------------
-- The numbers
-- ---------------------------------------------------------------------------

-- One mission per guest at most, and the largest group is 200.
create function public.max_event_missions() returns integer
language sql immutable set search_path = '' as $$ select 200 $$;

-- Names a host may list for personal missions: one per guest at most.
create function public.max_mission_people() returns integer
language sql immutable set search_path = '' as $$ select 200 $$;

-- The libraries a new event's list is drawn from: the general missions, plus
-- ones written for the kind of event the host picked on 02. Plain, doable by
-- anyone, nothing embarrassing or unsafe, no children singled out. The host
-- rewrites freely; an event keeps its own copy.
create function public.general_missions() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'A photo with someone you have never met',
    'Catch someone mid-laugh',
    'The best outfit in the room',
    'Find someone who shares your birthday month and take a photo together',
    'Someone dancing like nobody is watching',
    'Your table, from above',
    'Two people who look like best friends',
    'Someone''s shoes, up close',
    'A group photo with at least five people in it',
    'The food, before anyone touches it',
    'Someone who does not know you are taking the photo',
    'A photo with someone from a different group than yours',
    'The quietest moment you can find',
    'A toast, just as glasses meet',
    'Someone telling a story with their hands',
    'The most chaotic corner you can find',
    'A photo taken through a glass',
    'A pair of hands doing something',
    'The best detail nobody else noticed',
    'Get someone to pose like a movie star',
    'Find something red and make it the star of the photo',
    'A hug',
    'The sky',
    'Someone laughing so hard they cry',
    'A selfie with someone wearing glasses',
    'Everyone around you, looking the same way',
    'A photo from the lowest angle you can find',
    'Find someone whose name starts with your letter and take a photo together',
    'Your favourite moment so far',
    'The moment, without a single face in it',
    'Someone in the middle of a conversation',
    'A photo with the person wearing the brightest colour',
    'Something that will make everyone smile later',
    'A photo of your own shadow',
    'The last person you would expect to be photographed with',
    'Three people jumping at the same time',
    'A reflection, in a window, a mirror or a spoon',
    'A photo with the tallest person you can find',
    'A photo with someone whose shoes match yours',
    'The best smile in the room',
    'Two strangers making the same face',
    'A photo that tells a story without words',
    'Something tiny, as big as you can get it',
    'Someone doing something kind',
    'The view from exactly where you are standing',
    'Something round',
    'A selfie with three people you met today',
    'A high five, mid-air',
    'Someone pointing at something exciting',
    'Your group, all pulling silly faces',
    'The best hair in the room',
    'Today, summed up in one picture',
    'A photo with whoever travelled furthest to be here',
    'Someone caught mid-bite',
    'Your hand next to someone else''s',
    'A photo through something: a door, a gap, a frame',
    'A friend, when they are not posing',
    'The light at its most beautiful',
    'Someone wearing something they clearly love',
    'Two people who just met, already laughing'
  ]
$$;

create function public.event_type_missions(p_event_type public.event_type) returns text[]
language sql immutable set search_path = '' as $$
  select case p_event_type
    when 'wedding' then array[
      'The couple, when they think nobody is looking',
      'A photo with the person who has known the couple longest',
      'The rings',
      'The couple on the dance floor',
      'Someone wiping away a happy tear',
      'The cake, before the first cut',
      'A selfie with one of the newlyweds',
      'Someone from each family, in one photo',
      'The flowers',
      'Guests from both sides, arm in arm',
      'A speech, seen from the crowd',
      'Shoes coming off on the dance floor',
      'The wedding party in one frame',
      'Something blue',
      'The venue from its furthest corner',
      'A guest giving the couple advice',
      'The happiest face in the room',
      'The couple with the guest who travelled furthest',
      'Two guests who met today, toasting the couple',
      'The last dance of the night'
    ]
    when 'birthday' then array[
      'The birthday person blowing out the candles',
      'A selfie with the birthday person',
      'The cake',
      'Everyone singing happy birthday',
      'The birthday person opening a present',
      'A photo with whoever has known the birthday person longest',
      'The best present on the table',
      'The birthday person mid-laugh',
      'Someone wearing a party hat',
      'The balloons',
      'A toast to the birthday person',
      'The birthday person with their oldest friend',
      'Someone sneaking a piece of cake',
      'A group photo around the birthday person',
      'The birthday person dancing',
      'The age they are turning, made out of anything',
      'The card with the funniest message',
      'The birthday person, surprised',
      'Something sparkly',
      'The candles, glowing'
    ]
    when 'trip' then array[
      'The view that made everyone stop',
      'Your travel crew in front of a landmark',
      'The local food, before the first bite',
      'The best sign you see today',
      'Someone reading a map',
      'The packed car, bus or train',
      'Someone asleep on the way',
      'A local who says yes to a photo',
      'Your shoes on new ground',
      'The best sunset of the trip',
      'The ugliest souvenir',
      'The view from your window',
      'Someone taking a photo of the view',
      'Breakfast together',
      'The whole crew in one frame',
      'Something you would never see at home',
      'Someone looking out at the view',
      'The moment everyone laughed hardest',
      'The highest point you reach',
      'Luggage, piled up'
    ]
    when 'party' then array[
      'The host, in action',
      'A selfie with the host',
      'A photo with the person who has known the host longest',
      'The dance floor at its busiest',
      'A photo with whoever is making the music',
      'The best dance move of the night',
      'Someone singing along',
      'The snack table, mid-attack',
      'The last people still dancing',
      'At least five people doing the same dance move',
      'The most daring outfit',
      'Someone arriving',
      'The quietest corner of the party',
      'A toast with three strangers',
      'Lights, music, motion: a blurry one on purpose',
      'Someone teaching someone else a dance move',
      'The kitchen, where every party ends up',
      'Something that will make the host smile later',
      'Someone leaving with a smile',
      'The music, from behind the decks'
    ]
    when 'graduation' then array[
      'The graduate in their gown or best outfit',
      'A selfie with the graduate',
      'The graduate with their proudest family member',
      'Something thrown in the air',
      'The diploma',
      'The graduate with a favourite teacher',
      'The class in one frame',
      'Someone giving a speech',
      'The graduate laughing',
      'The proudest face in the room',
      'The graduate with the friend who got them through',
      'A photo with someone who studied something different',
      'The graduate''s first minute as a graduate',
      'The flowers or the gifts',
      'The building where it all happened',
      'The graduate and their oldest friend',
      'Someone wiping away a proud tear',
      'Three generations in one photo',
      'The graduate pointing at their future',
      'Everyone who came to celebrate, in one frame'
    ]
    when 'company' then array[
      'A photo with a colleague from another team',
      'A colleague you have only met online until today',
      'The whole team in one frame',
      'A photo with someone who started this year',
      'A photo with the person who has been here longest',
      'The coffee or drinks table',
      'Two departments, one high five',
      'Someone giving a speech',
      'Your team''s best smile',
      'A colleague teaching you something',
      'As many name badges as fit in one photo',
      'The organiser, in action',
      'Someone you would like to work with next',
      'The room, from where the speaker stands',
      'Your team pretending to be a band',
      'Someone from a different office or country',
      'The best conversation in the room',
      'Two colleagues who had never met, shaking hands',
      'The moment the event really got going',
      'Someone off duty for the first time today'
    ]
    else array[]::text[]
  end
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

alter table public.events
  add column missions_per_guest smallint
    check (missions_per_guest between 1 and 3);

-- The names the host listed. A guest claims one when joining.
create table public.mission_people (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  -- Kept as null if the guest's account goes; the name is then free again.
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),

  -- The target of event_missions' composite key, so a mission can only point at
  -- a person of its own event.
  unique (event_id, id)
);

create unique index mission_people_name_idx
  on public.mission_people (event_id, lower(btrim(name)));

-- One name per guest.
create unique index mission_people_one_claim_idx
  on public.mission_people (event_id, claimed_by) where claimed_by is not null;

create table public.event_missions (
  id         uuid primary key default gen_random_uuid(),
  -- Display and deal order.
  seq        bigint generated always as identity,
  event_id   uuid not null references public.events (id) on delete cascade,
  -- Set: a personal mission, dealt only to whoever claimed that person.
  person_id  uuid,
  body       text not null check (char_length(btrim(body)) between 3 and 140),
  created_at timestamptz not null default now(),

  foreign key (event_id, person_id)
    references public.mission_people (event_id, id) on delete cascade
);

create index event_missions_event_idx on public.event_missions (event_id, seq);

create table public.member_missions (
  event_id   uuid not null,
  user_id    uuid not null,
  mission_id uuid not null references public.event_missions (id) on delete cascade,
  -- The photo that fulfils it. If that photo is deleted the mission is open again.
  photo_id   uuid references public.photos (id) on delete set null,
  dealt_at   timestamptz not null default now(),

  primary key (user_id, mission_id),
  foreign key (event_id, user_id)
    references public.event_members (event_id, user_id) on delete cascade
);

-- A photo fulfils at most one mission.
create unique index member_missions_photo_idx
  on public.member_missions (photo_id) where photo_id is not null;
create index member_missions_event_idx on public.member_missions (event_id, user_id);
-- A mission goes to one guest. With fewer missions than guests, some get none.
create unique index member_missions_one_holder_idx on public.member_missions (mission_id);

-- ---------------------------------------------------------------------------
-- Helpers and limits
-- ---------------------------------------------------------------------------

create function public.is_event_host(p_event_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
     where e.id = p_event_id and e.host_id = p_user_id
  );
$$;

-- The host may write the list only while the event is being set up: once guests
-- hold cards from it, the list is fixed.
create function public.can_edit_missions(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
     where e.id = p_event_id
       and e.host_id = (select auth.uid())
       and e.status = 'setup'
       and e.ends_at > now()
  );
$$;

create function public.limit_event_missions()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.event_missions m where m.event_id = new.event_id)
       >= public.max_event_missions() then
    raise exception 'an event can have at most % missions', public.max_event_missions()
      using errcode = 'P0001', hint = 'limit';
  end if;
  return new;
end;
$$;

create trigger event_missions_limit
  before insert on public.event_missions
  for each row execute function public.limit_event_missions();

create function public.limit_mission_people()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.mission_people p where p.event_id = new.event_id)
       >= public.max_mission_people() then
    raise exception 'an event can list at most % people', public.max_mission_people()
      using errcode = 'P0001', hint = 'limit';
  end if;
  return new;
end;
$$;

create trigger mission_people_limit
  before insert on public.mission_people
  for each row execute function public.limit_mission_people();

-- Draws an event's starting list from the libraries, unless it already has
-- one. Each mission goes to one guest, so the list is as long as the group
-- could use (its cap times the count), up to what the libraries hold and
-- max_event_missions(). The event's own kind comes first — a small wedding
-- gets wedding missions — and the general ones fill up the rest. Internal:
-- called by create_event() and set_missions().
create function public.seed_missions(p_event_id uuid, p_per_guest integer)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  if exists (
    select 1 from public.event_missions m
     where m.event_id = p_event_id and m.person_id is null
  ) then
    return;
  end if;

  select * into v_event from public.events e where e.id = p_event_id;

  insert into public.event_missions (event_id, body)
  select p_event_id, t.body
    from (
      select own.body, 0 as tier
        from unnest(public.event_type_missions(v_event.event_type)) as own(body)
      union all
      select gen.body, 1 as tier
        from unnest(public.general_missions()) as gen(body)
    ) t
   order by t.tier, random()
   limit least(v_event.max_members * p_per_guest, public.max_event_missions());
end;
$$;

-- Hands one guest one mission nobody holds yet: their own personal ones first,
-- then a random one from the list. False when there is none left for them.
-- Internal.
create function public.deal_one_mission(p_event_id uuid, p_user_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_mission uuid;
begin
  select em.id into v_mission
    from public.event_missions em
    join public.mission_people mp on mp.id = em.person_id
   where em.event_id = p_event_id
     and mp.claimed_by = p_user_id
     and not exists (select 1 from public.member_missions mm where mm.mission_id = em.id)
   order by em.seq
   limit 1;

  if v_mission is null then
    -- skip locked: two late joiners dealing at once never reach for the same card.
    select em.id into v_mission
      from public.event_missions em
     where em.event_id = p_event_id
       and em.person_id is null
       and not exists (select 1 from public.member_missions mm where mm.mission_id = em.id)
     order by random()
     limit 1
     for update skip locked;
  end if;

  if v_mission is null then
    return false;
  end if;

  insert into public.member_missions (event_id, user_id, mission_id)
  values (p_event_id, p_user_id, v_mission)
  on conflict (mission_id) do nothing;

  return found;
end;
$$;

-- The deal, when the host starts the event. Round by round — everyone in the
-- group gets their first mission before anyone gets a second — so when the
-- list is shorter than the group needs, the missions are spread out and the
-- ones left without are whoever the shuffle put last. Internal.
create function public.deal_missions(p_event_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_per_guest integer;
  v_user      uuid;
begin
  select e.missions_per_guest into v_per_guest from public.events e where e.id = p_event_id;

  if v_per_guest is null then
    return;
  end if;

  for v_round in 1 .. v_per_guest loop
    for v_user in
      select m.user_id from public.event_members m
       where m.event_id = p_event_id
       order by random()
    loop
      if (select count(*) from public.member_missions mm
           where mm.event_id = p_event_id and mm.user_id = v_user) < v_round then
        perform public.deal_one_mission(p_event_id, v_user);
      end if;
    end loop;
  end loop;
end;
$$;

create function public.deal_missions_on_start()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.deal_missions(new.id);
  return new;
end;
$$;

create trigger events_deal_missions_on_start
  after update of status on public.events
  for each row
  when (old.status = 'setup' and new.status = 'live' and new.missions_per_guest is not null)
  execute function public.deal_missions_on_start();

-- ---------------------------------------------------------------------------
-- Switching missions on or off
-- ---------------------------------------------------------------------------

-- p_per_guest: NULL switches missions off (the list is kept), 1..3 switches them
-- on and fills an empty list. Host only, and only while the event is in setup.
create function public.set_missions(p_event_id uuid, p_per_guest integer)
returns public.events
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_per_guest is not null and p_per_guest not between 1 and 3 then
    raise exception 'missions per guest must be between 1 and 3' using errcode = '22023';
  end if;

  select * into v_event from public.events e where e.id = p_event_id for update;

  if not found then
    raise exception 'no such event' using errcode = 'P0002';
  end if;

  if v_event.host_id <> auth.uid() then
    raise exception 'only the host can change the missions' using errcode = '42501';
  end if;

  if v_event.status <> 'setup' or v_event.ends_at <= now() then
    raise exception 'the missions are fixed once the event has started'
      using errcode = 'P0001', hint = 'started';
  end if;

  update public.events set missions_per_guest = p_per_guest
   where id = p_event_id returning * into v_event;

  if p_per_guest is not null then
    perform public.seed_missions(p_event_id, p_per_guest);
  end if;

  return v_event;
end;
$$;

-- create_event() with the option. A new signature, so the old one goes; the
-- body is the same as before apart from the marked lines.
drop function public.create_event(
  text, public.event_type, public.film_look, timestamptz, integer, integer, text
);

create function public.create_event(
  p_name               text,
  p_event_type         public.event_type,
  p_look               public.film_look,
  p_ends_at            timestamptz,
  p_max_members        integer,
  p_roll_size          integer,
  p_transaction_id     text default null,
  p_missions_per_guest integer default null
)
returns public.events
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_anonymous boolean;
  v_purchase  public.purchases%rowtype;
  v_event     public.events%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select u.is_anonymous into v_anonymous from auth.users u where u.id = v_user;

  if coalesce(v_anonymous, false) then
    raise exception 'hosting an event requires a full account'
      using errcode = '42501', hint = 'anonymous';
  end if;

  if p_ends_at <= now() then
    raise exception 'that ending time has already passed' using errcode = 'P0001';
  end if;

  if p_ends_at > now() + make_interval(days => public.max_event_days()) then
    raise exception 'an event can run for at most % days', public.max_event_days()
      using errcode = 'P0001';
  end if;

  if p_max_members is null or p_max_members < 2 or p_max_members > public.max_event_members() then
    raise exception 'invalid group size' using errcode = '22023';
  end if;

  if p_roll_size is not null and p_roll_size not in (5, 10, 16, 24, 36) then
    raise exception 'invalid roll size' using errcode = '22023';
  end if;

  -- new
  if p_missions_per_guest is not null and p_missions_per_guest not between 1 and 3 then
    raise exception 'missions per guest must be between 1 and 3' using errcode = '22023';
  end if;

  if p_roll_size is null or p_max_members > public.free_max_members() then
    select * into v_purchase
      from public.purchases
     where user_id = v_user
       and consumed_at is null
       and max_members >= p_max_members
     order by (store_transaction_id is distinct from p_transaction_id), purchased_at
     for update skip locked
     limit 1;

    if not found then
      raise exception 'no unspent purchase covers this event'
        using errcode = 'P0002', hint = 'unsettled';
    end if;
  end if;

  insert into public.events
    (host_id, name, event_type, look, ends_at, max_members, roll_size, missions_per_guest)
  values
    (v_user, trim(p_name), p_event_type, p_look, p_ends_at, p_max_members, p_roll_size,
     p_missions_per_guest)
  returning * into v_event;

  -- new
  if v_event.missions_per_guest is not null then
    perform public.seed_missions(v_event.id, v_event.missions_per_guest);
  end if;

  if v_purchase.id is not null then
    update public.purchases
       set consumed_at = now(), consumed_by_event_id = v_event.id
     where id = v_purchase.id;
  end if;

  return v_event;
end;
$$;

-- ---------------------------------------------------------------------------
-- Joining: picking your name
-- ---------------------------------------------------------------------------

-- The names the host listed and nobody has claimed yet, for the join screen.
-- The invite code is the credential (as in join_event()), so a code resolves its
-- own event's names and nobody else's. Nobody is a member yet at this point.
create function public.mission_people_for_invite(p_invite_code text)
returns table (person_id uuid, name text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name
    from public.mission_people p
    join public.events e on e.id = p.event_id
   where auth.uid() is not null
     and e.invite_code = upper(trim(p_invite_code))
     and e.missions_per_guest is not null
     and e.status <> 'developed'
     and p.claimed_by is null
   order by lower(p.name);
$$;

-- "That's me." p_person_id NULL gives your name back. Refused with hint 'taken'
-- when someone else has it, and with 'already_dealt' once your missions were
-- dealt: your cards do not change after that.
create function public.claim_mission_person(p_event_id uuid, p_person_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_member public.event_members%rowtype;
  v_person public.mission_people%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_member
    from public.event_members m
   where m.event_id = p_event_id and m.user_id = v_user
   for update;

  if not found then
    raise exception 'not a member of this event' using errcode = '42501';
  end if;

  if public.is_event_developed(p_event_id) then
    raise exception 'the film is developed' using errcode = 'P0001', hint = 'event_closed';
  end if;

  if exists (
    select 1 from public.member_missions mm
     where mm.event_id = p_event_id and mm.user_id = v_user
  ) then
    raise exception 'your missions were already dealt' using errcode = 'P0001', hint = 'already_dealt';
  end if;

  -- Give back whatever you held; if the new name is taken, the whole call rolls
  -- back and you keep it.
  update public.mission_people p
     set claimed_by = null, claimed_at = null
   where p.event_id = p_event_id and p.claimed_by = v_user;

  if p_person_id is null then
    return;
  end if;

  select * into v_person
    from public.mission_people p
   where p.id = p_person_id and p.event_id = p_event_id
   for update;

  if not found then
    raise exception 'no such name' using errcode = 'P0002';
  end if;

  if v_person.claimed_by is not null then
    raise exception 'someone else is already using that name'
      using errcode = 'P0001', hint = 'taken';
  end if;

  update public.mission_people p
     set claimed_by = v_user, claimed_at = now()
   where p.id = p_person_id;
end;
$$;

-- The host links a name to a guest who has already joined — planning before
-- the start, so a guest who is in the group gets their personal missions
-- without picking anything — or, with p_user_id NULL, frees a name somebody
-- claimed by mistake. A guest holds one name: linking moves them off any other.
-- Setup only: once the event starts the cards are dealt and nothing moves.
create function public.assign_mission_person(p_person_id uuid, p_user_id uuid default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_person public.mission_people%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_person from public.mission_people p where p.id = p_person_id for update;

  if not found then
    raise exception 'no such name' using errcode = 'P0002';
  end if;

  if not public.can_edit_missions(v_person.event_id) then
    raise exception 'only the host can do this, before the event starts'
      using errcode = '42501', hint = 'started';
  end if;

  if p_user_id is not null and not public.is_event_member(v_person.event_id, p_user_id) then
    raise exception 'that guest is not in this group' using errcode = 'P0002', hint = 'not_member';
  end if;

  update public.mission_people p
     set claimed_by = null, claimed_at = null
   where p.event_id = v_person.event_id
     and p.id <> p_person_id
     and p.claimed_by = p_user_id;

  update public.mission_people p
     set claimed_by = p_user_id,
         claimed_at = case when p_user_id is null then null else now() end
   where p.id = p_person_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dealing, and fulfilling
-- ---------------------------------------------------------------------------

-- Your missions. Everyone in the group is dealt when the host starts the event
-- (deal_missions()). Someone who joins later is dealt here, on their first call,
-- from what is left: their own personal ones, then any mission nobody holds.
-- With nothing left they get none. Every later call returns the same cards.
-- Before the event is live, or with missions off, it is empty.
create function public.my_missions(p_event_id uuid)
returns table (mission_id uuid, body text, personal boolean, photo_id uuid)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_event  public.events%rowtype;
  v_member public.event_members%rowtype;
  v_have   integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- The member row serialises one guest's calls, so a double tap cannot deal twice.
  select * into v_member
    from public.event_members m
   where m.event_id = p_event_id and m.user_id = v_user
   for update;

  if not found then
    raise exception 'not a member of this event' using errcode = '42501';
  end if;

  select * into v_event from public.events e where e.id = p_event_id;

  if v_event.missions_per_guest is null then
    return;
  end if;

  if v_event.status = 'live' and v_event.ends_at > now()
     and not exists (
       select 1 from public.member_missions mm
        where mm.event_id = p_event_id and mm.user_id = v_user
     ) then
    for v_have in 1 .. v_event.missions_per_guest loop
      exit when not public.deal_one_mission(p_event_id, v_user);
    end loop;
  end if;

  return query
  select em.id, em.body, (em.person_id is not null), mm.photo_id
    from public.member_missions mm
    join public.event_missions em on em.id = mm.mission_id
   where mm.event_id = p_event_id and mm.user_id = v_user
   order by (em.person_id is null), em.seq;
end;
$$;

-- "This photo was for that mission." p_mission_id NULL says it was for none.
-- One photo, one mission: tagging moves the photo off whatever it held and
-- replaces what the mission held. Works on a frame whose upload is still
-- pending, and until the film is developed.
create function public.set_photo_mission(p_photo_id uuid, p_mission_id uuid default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_photo public.photos%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_photo
    from public.photos p
   where p.id = p_photo_id and p.user_id = v_user;

  if not found then
    raise exception 'no such photo' using errcode = 'P0002';
  end if;

  if public.is_event_developed(v_photo.event_id) then
    raise exception 'the film is developed' using errcode = 'P0001', hint = 'event_closed';
  end if;

  perform 1 from public.member_missions mm
   where mm.event_id = v_photo.event_id and mm.user_id = v_user
   for update;

  update public.member_missions mm set photo_id = null where mm.photo_id = p_photo_id;

  if p_mission_id is null then
    return;
  end if;

  update public.member_missions mm
     set photo_id = p_photo_id
   where mm.user_id = v_user
     and mm.mission_id = p_mission_id
     and mm.event_id = v_photo.event_id;

  if not found then
    raise exception 'that is not one of your missions' using errcode = 'P0002', hint = 'not_yours';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.mission_people  enable row level security;
alter table public.event_missions  enable row level security;
alter table public.member_missions enable row level security;

-- The host sees every name and who claimed it; a guest sees only their own.
create policy "mission people: host reads all, a guest their own"
  on public.mission_people for select to authenticated
  using (
    public.is_event_host(event_id, (select auth.uid()))
    or claimed_by = (select auth.uid())
  );

create policy "mission people: host adds in setup"
  on public.mission_people for insert to authenticated
  with check (public.can_edit_missions(event_id));

create policy "mission people: host edits in setup"
  on public.mission_people for update to authenticated
  using (public.can_edit_missions(event_id))
  with check (public.can_edit_missions(event_id));

create policy "mission people: host removes in setup"
  on public.mission_people for delete to authenticated
  using (public.can_edit_missions(event_id));

-- The host reads the whole list. A guest reads the missions they were dealt —
-- never the rest, so nobody can go through the list — and everyone reads all of
-- them once the film is developed, to see what each photo was for.
create policy "event missions: host, the dealt, and everyone once developed"
  on public.event_missions for select to authenticated
  using (
    public.is_event_host(event_id, (select auth.uid()))
    or exists (
      select 1 from public.member_missions mm
       where mm.mission_id = event_missions.id and mm.user_id = (select auth.uid())
    )
    or (
      public.is_event_member(event_id, (select auth.uid()))
      and public.is_event_developed(event_id)
    )
  );

create policy "event missions: host adds in setup"
  on public.event_missions for insert to authenticated
  with check (public.can_edit_missions(event_id));

create policy "event missions: host edits in setup"
  on public.event_missions for update to authenticated
  using (public.can_edit_missions(event_id))
  with check (public.can_edit_missions(event_id));

create policy "event missions: host removes in setup"
  on public.event_missions for delete to authenticated
  using (public.can_edit_missions(event_id));

-- THE REVEAL for missions: your own cards always; everyone's — and so which
-- photo went with which mission — only once the film is developed.
create policy "member missions: own always, everyone's once developed"
  on public.member_missions for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.is_event_member(event_id, (select auth.uid()))
      and public.is_event_developed(event_id)
    )
  );

revoke all on public.mission_people, public.event_missions, public.member_missions
  from anon, authenticated;

grant select on public.mission_people, public.event_missions, public.member_missions
  to authenticated;

-- Columns, not tables: nothing that places or moves a row is writable.
grant insert (event_id, name), update (name), delete on public.mission_people to authenticated;
grant insert (event_id, person_id, body), update (body), delete on public.event_missions
  to authenticated;

-- ---------------------------------------------------------------------------
-- Functions: nothing for anon; clients get only the doors.
-- ---------------------------------------------------------------------------

revoke all on function
  public.max_event_missions(),
  public.max_mission_people(),
  public.general_missions(),
  public.event_type_missions(public.event_type),
  public.is_event_host(uuid, uuid),
  public.can_edit_missions(uuid),
  public.limit_event_missions(),
  public.limit_mission_people(),
  public.seed_missions(uuid, integer),
  public.deal_one_mission(uuid, uuid),
  public.deal_missions(uuid),
  public.deal_missions_on_start(),
  public.set_missions(uuid, integer),
  public.create_event(
    text, public.event_type, public.film_look, timestamptz, integer, integer, text, integer
  ),
  public.mission_people_for_invite(text),
  public.claim_mission_person(uuid, uuid),
  public.assign_mission_person(uuid, uuid),
  public.my_missions(uuid),
  public.set_photo_mission(uuid, uuid)
from public, anon, authenticated;

-- Policies call these as the caller, so they need EXECUTE.
grant execute on function public.is_event_host(uuid, uuid) to authenticated;
grant execute on function public.can_edit_missions(uuid) to authenticated;
grant execute on function public.max_event_missions() to authenticated;
grant execute on function public.max_mission_people() to authenticated;

grant execute on function public.create_event(
  text, public.event_type, public.film_look, timestamptz, integer, integer, text, integer
) to authenticated;
grant execute on function public.set_missions(uuid, integer) to authenticated;
grant execute on function public.mission_people_for_invite(text) to authenticated;
grant execute on function public.claim_mission_person(uuid, uuid) to authenticated;
grant execute on function public.assign_mission_person(uuid, uuid) to authenticated;
grant execute on function public.my_missions(uuid) to authenticated;
grant execute on function public.set_photo_mission(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Nothing here. Missions are read when a screen opens; and member_missions must
-- never announce a photo before the reveal, as with photos itself.
