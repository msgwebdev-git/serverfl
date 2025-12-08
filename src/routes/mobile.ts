import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { supabase } from '../services/supabase.js';

const router = Router();

// ==========================================
// TICKETS
// ==========================================

// GET /api/mobile/tickets - Get all active tickets with options
router.get('/tickets', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select(`
        id,
        name,
        name_ro,
        name_ru,
        description_ro,
        description_ru,
        features_ro,
        features_ru,
        price,
        original_price,
        currency,
        is_active,
        sort_order,
        max_per_order,
        has_options,
        ticket_options (
          id,
          name,
          name_ro,
          name_ru,
          description_ro,
          description_ru,
          price_modifier,
          is_default,
          sort_order
        )
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new AppError(`Database error: ${error.message}`, 500);
    }

    // Transform to camelCase for mobile
    const transformedTickets = (tickets || []).map(ticket => ({
      id: ticket.id,
      name: ticket.name,
      nameRo: ticket.name_ro,
      nameRu: ticket.name_ru,
      descriptionRo: ticket.description_ro,
      descriptionRu: ticket.description_ru,
      featuresRo: ticket.features_ro || [],
      featuresRu: ticket.features_ru || [],
      price: Number(ticket.price),
      originalPrice: ticket.original_price ? Number(ticket.original_price) : null,
      currency: ticket.currency || 'MDL',
      maxPerOrder: ticket.max_per_order || 10,
      hasOptions: ticket.has_options || false,
      options: (ticket.ticket_options || []).map((opt: any) => ({
        id: opt.id,
        name: opt.name,
        nameRo: opt.name_ro,
        nameRu: opt.name_ru,
        descriptionRo: opt.description_ro,
        descriptionRu: opt.description_ru,
        priceModifier: Number(opt.price_modifier) || 0,
        isDefault: opt.is_default || false,
        sortOrder: opt.sort_order,
      })).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    }));

    res.json({
      success: true,
      data: {
        tickets: transformedTickets,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// LINEUP
// ==========================================

// GET /api/mobile/lineup - Get artists lineup
router.get('/lineup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    const { data: artists, error } = await supabase
      .from('artists')
      .select('*')
      .eq('year', year)
      .eq('is_active', true)
      .order('is_headliner', { ascending: false })
      .order('sort_order', { ascending: true });

    if (error) {
      throw new AppError(`Database error: ${error.message}`, 500);
    }

    // Get available years
    const { data: yearsData } = await supabase
      .from('artists')
      .select('year')
      .eq('is_active', true);

    const years = [...new Set((yearsData || []).map(a => a.year))].sort((a, b) => b - a);

    // Separate headliners
    const headliners = (artists || []).filter(a => a.is_headliner);
    const regularArtists = (artists || []).filter(a => !a.is_headliner);

    // Group by day/stage
    const groupedByDay: Record<string, any[]> = {};
    regularArtists.forEach(artist => {
      const day = artist.day || 'Day 1';
      if (!groupedByDay[day]) {
        groupedByDay[day] = [];
      }
      groupedByDay[day].push({
        id: artist.id,
        name: artist.name,
        imageUrl: artist.image_url,
        stage: artist.stage,
        day: artist.day,
        performanceTime: artist.performance_time,
        country: artist.country,
        genre: artist.genre,
        isHeadliner: artist.is_headliner,
        socialLinks: {
          instagram: artist.instagram_url,
          spotify: artist.spotify_url,
          youtube: artist.youtube_url,
        },
      });
    });

    // Calculate stats
    const stats = {
      headlinersCount: headliners.length,
      totalArtists: (artists || []).length,
      stages: [...new Set((artists || []).map(a => a.stage).filter(Boolean))].length,
      days: Object.keys(groupedByDay).length || 1,
    };

    res.json({
      success: true,
      data: {
        year,
        years,
        headliners: headliners.map(a => ({
          id: a.id,
          name: a.name,
          imageUrl: a.image_url,
          stage: a.stage,
          day: a.day,
          performanceTime: a.performance_time,
          country: a.country,
          genre: a.genre,
        })),
        days: Object.entries(groupedByDay).map(([day, dayArtists]) => ({
          name: day,
          artists: dayArtists,
        })),
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// NEWS
// ==========================================

// GET /api/mobile/news - Get news list with pagination
router.get('/news', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const locale = (req.query.locale as string) || 'ro';
    const offset = (page - 1) * limit;

    // Get total count
    const { count } = await supabase
      .from('news')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);

    // Get paginated news
    const { data: news, error } = await supabase
      .from('news')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new AppError(`Database error: ${error.message}`, 500);
    }

    const transformedNews = (news || []).map(article => ({
      id: article.id,
      slug: article.slug,
      title: locale === 'ru' ? article.title_ru : article.title_ro,
      excerpt: locale === 'ru' ? article.excerpt_ru : article.excerpt_ro,
      coverImage: article.cover_image,
      category: article.category,
      publishedAt: article.published_at,
    }));

    res.json({
      success: true,
      data: {
        news: transformedNews,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasMore: offset + limit < (count || 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/mobile/news/:slug - Get single news article
router.get('/news/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const locale = (req.query.locale as string) || 'ro';

    const { data: article, error } = await supabase
      .from('news')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (error || !article) {
      throw new AppError('Article not found', 404);
    }

    // Get related articles (same category, excluding current)
    const { data: related } = await supabase
      .from('news')
      .select('id, slug, title_ro, title_ru, cover_image, published_at')
      .eq('is_published', true)
      .eq('category', article.category)
      .neq('id', article.id)
      .order('published_at', { ascending: false })
      .limit(3);

    res.json({
      success: true,
      data: {
        article: {
          id: article.id,
          slug: article.slug,
          title: locale === 'ru' ? article.title_ru : article.title_ro,
          content: locale === 'ru' ? article.content_ru : article.content_ro,
          excerpt: locale === 'ru' ? article.excerpt_ru : article.excerpt_ro,
          coverImage: article.cover_image,
          category: article.category,
          publishedAt: article.published_at,
        },
        related: (related || []).map(r => ({
          id: r.id,
          slug: r.slug,
          title: locale === 'ru' ? r.title_ru : r.title_ro,
          coverImage: r.cover_image,
          publishedAt: r.published_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GALLERY
// ==========================================

// GET /api/mobile/gallery - Get gallery images
router.get('/gallery', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : null;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    // Get available years
    const { data: yearsData } = await supabase
      .from('gallery')
      .select('year')
      .eq('is_active', true);

    const years = [...new Set((yearsData || []).map(g => g.year))].sort((a, b) => b - a);
    const selectedYear = year || years[0] || new Date().getFullYear();

    // Get total count for selected year
    const { count } = await supabase
      .from('gallery')
      .select('*', { count: 'exact', head: true })
      .eq('year', selectedYear)
      .eq('is_active', true);

    // Get images
    const { data: images, error } = await supabase
      .from('gallery')
      .select('*')
      .eq('year', selectedYear)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new AppError(`Database error: ${error.message}`, 500);
    }

    res.json({
      success: true,
      data: {
        years,
        selectedYear,
        images: (images || []).map(img => ({
          id: img.id,
          thumbnailUrl: img.thumbnail_url,
          fullUrl: img.full_url,
          year: img.year,
          order: img.display_order,
        })),
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasMore: offset + limit < (count || 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// PROGRAM / SCHEDULE
// ==========================================

// GET /api/mobile/program - Get festival program/schedule
router.get('/program', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date as string;
    const locale = (req.query.locale as string) || 'ro';

    const { data: events, error } = await supabase
      .from('program')
      .select('*')
      .eq('is_active', true)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      throw new AppError(`Database error: ${error.message}`, 500);
    }

    // Get unique dates
    const dates = [...new Set((events || []).map(e => e.date))].sort();

    // Filter by date if provided
    let filteredEvents = events || [];
    if (date) {
      filteredEvents = filteredEvents.filter(e => e.date === date);
    }

    // Group by date
    const groupedByDate: Record<string, any[]> = {};
    filteredEvents.forEach(event => {
      const eventDate = event.date;
      if (!groupedByDate[eventDate]) {
        groupedByDate[eventDate] = [];
      }
      groupedByDate[eventDate].push({
        id: event.id,
        title: locale === 'ru' ? event.title_ru : event.title_ro,
        description: locale === 'ru' ? event.description_ru : event.description_ro,
        startTime: event.start_time,
        endTime: event.end_time,
        stage: event.stage,
        category: event.category,
        imageUrl: event.image_url,
      });
    });

    res.json({
      success: true,
      data: {
        dates,
        schedule: Object.entries(groupedByDate).map(([eventDate, dayEvents]) => ({
          date: eventDate,
          events: dayEvents,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// PARTNERS
// ==========================================

// GET /api/mobile/partners - Get festival partners
router.get('/partners', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: partners, error } = await supabase
      .from('partners')
      .select('*')
      .eq('is_active', true)
      .order('tier', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) {
      throw new AppError(`Database error: ${error.message}`, 500);
    }

    // Group by tier
    const tiers = ['platinum', 'gold', 'silver', 'bronze', 'media', 'other'];
    const groupedPartners: Record<string, any[]> = {};

    tiers.forEach(tier => {
      const tierPartners = (partners || []).filter(p => p.tier === tier);
      if (tierPartners.length > 0) {
        groupedPartners[tier] = tierPartners.map(p => ({
          id: p.id,
          name: p.name,
          logo: p.logo_url,
          website: p.website_url,
          tier: p.tier,
        }));
      }
    });

    res.json({
      success: true,
      data: {
        partners: groupedPartners,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// ACTIVITIES
// ==========================================

// GET /api/mobile/activities - Get festival activities
router.get('/activities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locale = (req.query.locale as string) || 'ro';

    const { data: activities, error } = await supabase
      .from('activities')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new AppError(`Database error: ${error.message}`, 500);
    }

    res.json({
      success: true,
      data: {
        activities: (activities || []).map(a => ({
          id: a.id,
          title: locale === 'ru' ? a.title_ru : a.title_ro,
          description: locale === 'ru' ? a.description_ru : a.description_ro,
          imageUrl: a.image_url,
          location: a.location,
          category: a.category,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// AFTERMOVIES
// ==========================================

// GET /api/mobile/aftermovies - Get aftermovie videos
router.get('/aftermovies', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: videos, error } = await supabase
      .from('aftermovies')
      .select('*')
      .eq('is_active', true)
      .order('year', { ascending: false });

    if (error) {
      throw new AppError(`Database error: ${error.message}`, 500);
    }

    res.json({
      success: true,
      data: {
        videos: (videos || []).map(v => ({
          id: v.id,
          title: v.title,
          youtubeId: v.youtube_id,
          thumbnail: v.thumbnail_url || `https://img.youtube.com/vi/${v.youtube_id}/maxresdefault.jpg`,
          year: v.year,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GENERAL INFO
// ==========================================

// GET /api/mobile/info - Get general festival info
router.get('/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locale = (req.query.locale as string) || 'ro';

    // Get site contacts
    const { data: siteContacts } = await supabase
      .from('site_contacts')
      .select('*');

    // Get department contacts
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    // Transform site contacts to key-value object
    const siteInfo: Record<string, string> = {};
    (siteContacts || []).forEach(c => {
      siteInfo[c.key] = c.value;
    });

    // Get FAQ
    const { data: faq } = await supabase
      .from('faq')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    res.json({
      success: true,
      data: {
        festivalName: 'FL Festival',
        dates: {
          start: siteInfo.festival_start_date || '2025-08-15',
          end: siteInfo.festival_end_date || '2025-08-16',
        },
        location: {
          name: locale === 'ru' ? 'Старый Орхей' : 'Orheiul Vechi',
          address: siteInfo.address || 'Orheiul Vechi, Moldova',
          coordinates: {
            lat: parseFloat(siteInfo.latitude || '47.0167'),
            lng: parseFloat(siteInfo.longitude || '28.9833'),
          },
        },
        contacts: (contacts || []).map(c => ({
          department: c.department_key,
          email: c.email,
          phone: c.phone,
        })),
        social: {
          instagram: siteInfo.instagram_url || '',
          facebook: siteInfo.facebook_url || '',
          telegram: siteInfo.telegram_url || '',
          youtube: siteInfo.youtube_url || '',
          tiktok: siteInfo.tiktok_url || '',
        },
        faq: (faq || []).map(f => ({
          id: f.id,
          question: locale === 'ru' ? f.question_ru : f.question_ro,
          answer: locale === 'ru' ? f.answer_ru : f.answer_ro,
          category: f.category,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// PUSH NOTIFICATIONS - DEVICE REGISTRATION
// ==========================================

const registerDeviceSchema = z.object({
  deviceToken: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  language: z.enum(['ro', 'ru']).optional().default('ro'),
});

// POST /api/mobile/devices/register - Register device for push notifications
router.post('/devices/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = registerDeviceSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError(`Validation error: ${validation.error.message}`, 400);
    }

    const { deviceToken, platform, language } = validation.data;

    // Upsert device token
    const { error } = await supabase
      .from('device_tokens')
      .upsert({
        token: deviceToken,
        platform,
        language,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'token',
      });

    if (error) {
      throw new AppError(`Database error: ${error.message}`, 500);
    }

    res.json({
      success: true,
      message: 'Device registered successfully',
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/mobile/devices/:token - Unregister device
router.delete('/devices/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;

    const { error } = await supabase
      .from('device_tokens')
      .delete()
      .eq('token', token);

    if (error) {
      throw new AppError(`Database error: ${error.message}`, 500);
    }

    res.json({
      success: true,
      message: 'Device unregistered successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// APP VERSION CHECK
// ==========================================

// GET /api/mobile/version - Check for app updates
router.get('/version', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const platform = req.query.platform as string;
    const currentVersion = req.query.version as string;

    // This could be fetched from database or config
    const latestVersions = {
      ios: {
        version: '1.0.0',
        minVersion: '1.0.0',
        updateUrl: 'https://apps.apple.com/app/fl-festival/id123456789',
      },
      android: {
        version: '1.0.0',
        minVersion: '1.0.0',
        updateUrl: 'https://play.google.com/store/apps/details?id=md.flfestival.app',
      },
    };

    const platformInfo = latestVersions[platform as keyof typeof latestVersions] || latestVersions.android;

    // Simple version comparison (could be more sophisticated)
    const isUpdateAvailable = currentVersion && currentVersion < platformInfo.version;
    const isForceUpdate = currentVersion && currentVersion < platformInfo.minVersion;

    res.json({
      success: true,
      data: {
        latestVersion: platformInfo.version,
        minVersion: platformInfo.minVersion,
        updateUrl: platformInfo.updateUrl,
        isUpdateAvailable,
        isForceUpdate,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
