import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);

    // Build filter object
    const filter: Record<string, any> = {};

    // Filter by name
    const name = searchParams.get("name");
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    // Filter by email
    const email = searchParams.get("email");
    if (email) {
      filter.email = { $regex: email, $options: "i" };
    }

    // Filter by phone (case-insensitive partial match)
    const phone = searchParams.get("phone");
    if (phone) {
      filter.phone = { $regex: phone, $options: "i" };
    }

    // Filter by role
    const role = searchParams.get("role");
    if (role) {
      const roles = role.split(",").map((r) => r.trim()).filter(Boolean);
      if (roles.length > 0) {
        filter.role = roles.length === 1 ? roles[0] : { $in: roles };
      }
    }

    // Filter by department
    const department = searchParams.get("department");
    if (department) {
      const departments = department.split(",").map((d) => d.trim()).filter(Boolean);
      if (departments.length > 0) {
        filter.department = departments.length === 1 ? departments[0] : { $in: departments };
      }
    }

    // Filter by age range
    const minAge = searchParams.get("minAge");
    const maxAge = searchParams.get("maxAge");
    if (minAge || maxAge) {
      filter.age = {};
      if (minAge) {
        filter.age.$gte = Number(minAge);
      }
      if (maxAge) {
        filter.age.$lte = Number(maxAge);
      }
    }

    const users = await User.find(filter).sort({ createdAt: -1 });
    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { name, email, phone, age, address, role, department } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const user = await User.create({
      name,
      email,
      phone: phone || undefined,
      age: age ? Number(age) : undefined,
      address: address || undefined,
      role: role || undefined,
      department: department || undefined,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating user:", error);
    if (error instanceof Error && error.message.includes("duplicate")) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
