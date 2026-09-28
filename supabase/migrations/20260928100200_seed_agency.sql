-- =============================================================================
-- Seed: the first agency and its starting staff categories.
-- Categories are ordinary rows — the owner adds/renames/removes them in the
-- admin panel; nothing in the app hardcodes this list.
-- =============================================================================

insert into public.agencies (slug, name, tagline, phone, whatsapp, email, brand, settings)
values (
  'alicia',
  'Alicia Staffing Agency',
  'Your Trusted Home Support Partner',
  '+254726407535',
  '254726407535',
  'aliciastaffingagency@gmail.com',
  jsonb_build_object(
    'primary', '#D61F7A',
    'primary_dark', '#A8155E',
    'navy', '#1C1F4A',
    'gold', '#D4A43A',
    'blush', '#FDF1F5'
  ),
  jsonb_build_object(
    'service_area_label', 'Serving all areas',
    'map_center', jsonb_build_array(-1.286389, 36.817223),
    -- Marketing counters are shown only once the owner fills them with real figures.
    'stats', jsonb_build_array()
  )
)
on conflict (slug) do nothing;

insert into public.staff_categories (agency_id, name, slug, description, icon, sort_order)
select a.id, c.name, c.slug, c.description, c.icon, c.sort_order
from public.agencies a
cross join (values
  ('House Help',              'house-help',       'Day-to-day cleaning, tidying, laundry and general home support.',       'Home',          10),
  ('Nanny',                   'nanny',            'Loving, attentive childcare for babies, toddlers and school-age kids.', 'Baby',          20),
  ('Cleaner',                 'cleaner',          'Deep cleans, move-in/move-out cleans and regular house cleaning.',     'Sparkles',      30),
  ('Caregiver / Elder Care',  'caregiver',        'Patient companionship and daily support for elderly family members.',  'HeartHandshake',40),
  ('Cooking Assistant / Chef','cook-chef',        'Home-cooked meals, meal prep and kitchen management.',                 'ChefHat',       50),
  ('Laundry & Ironing',       'laundry-ironing',  'Washing, ironing and careful handling of your household linens.',      'Shirt',         60),
  ('House Manager',           'house-manager',    'Runs the household: staff, shopping, schedules and supplies.',         'ClipboardList', 70),
  ('Driver',                  'driver',           'Safe, punctual drivers for school runs, errands and family trips.',    'Car',           80),
  ('Shamba Boy / Gardener',   'gardener',         'Garden, lawn and compound care, from planting to upkeep.',             'Sprout',        90),
  ('Shop Attendant',          'shop-attendant',   'Friendly, honest attendants for shops, kiosks and small businesses.',  'Store',        100),
  ('Security Guard',          'security-guard',   'Reliable day and night guards for homes and business premises.',       'ShieldCheck',  110)
) as c(name, slug, description, icon, sort_order)
where a.slug = 'alicia'
on conflict (agency_id, slug) do nothing;
