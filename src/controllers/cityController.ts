/**
 * City Controller
 * Handles city and city route management (Admin only)
 */

import { Request, Response, NextFunction } from "express";
import * as cityService from "../services/cityService";
import { createError } from "../utils/errorHandler";

/**
 * Create a new city (Admin only)
 * POST /admin/cities
 */
export const createCity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, state } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw createError("City name is required", 400);
    }

    const city = await cityService.createCity({ name, state });

    res.status(201).json({
      success: true,
      data: { city },
      message: "City created successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get all cities
 * GET /admin/cities
 */
export const getAllCities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const cities = await cityService.getAllCities();

    res.json({
      success: true,
      data: { cities },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update city (Admin only)
 * PUT /admin/cities/:id
 */
export const updateCity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const city = await cityService.updateCity(id, updates);

    res.json({
      success: true,
      data: { city },
      message: "City updated successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Delete city (Admin only)
 * DELETE /admin/cities/:id
 */
export const deleteCity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    await cityService.deleteCity(id);

    res.json({
      success: true,
      message: "City deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Create or update city route pricing (Admin only)
 * POST /admin/cities/routes
 */
export const upsertCityRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { fromCity, toCity, baseFare, heavyFare, gstPercent } = req.body;

    if (!fromCity || !toCity) {
      throw createError("From city and to city are required", 400);
    }

    if (!baseFare || typeof baseFare !== "number" || baseFare <= 0) {
      throw createError("Base fare must be a positive number", 400);
    }

    if (!heavyFare || typeof heavyFare !== "number" || heavyFare <= 0) {
      throw createError("Heavy fare must be a positive number", 400);
    }

    const route = await cityService.upsertCityRoute({
      fromCity,
      toCity,
      baseFare,
      heavyFare,
      gstPercent,
    });

    res.json({
      success: true,
      data: { route },
      message: "City route pricing updated successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get all city routes (Admin only)
 * GET /admin/cities/routes
 */
export const getAllCityRoutes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const routes = await cityService.getAllCityRoutes();

    res.json({
      success: true,
      data: { routes },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Delete city route (Admin only)
 * DELETE /admin/cities/routes/:id
 */
export const deleteCityRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    await cityService.deleteCityRoute(id);

    res.json({
      success: true,
      message: "City route deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

