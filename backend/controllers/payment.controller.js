// import razorpay from "../config/razorpay.js";
// import Payment from "../models/Payment.model.js";
// import User from "../models/user.model.js";
// import crypto from "crypto";

// const Plans = {
//   pro: {
//     name: "Pro",
//     amount: 29900, // ₹299
//     credits: 500,
//   },
//   team: {
//     name: "Team",
//     amount: 79900, // ₹799
//     credits: 2000,
//   },
// };

// export const createOrder = async (req, res) => {
//   try {
//     const userId = req.user._id;

//     if (!userId) {
//       return res.status(400).json({
//         message: "User ID is required",
//       });
//     }

//     const { plan } = req.body;
//     const selectedPlan = Plans[plan];

//     if (!selectedPlan) {
//       return res.status(400).json({
//         message: "plan not found",
//       });
//     }

//     const order = await razorpay.orders.create({
//       amount: selectedPlan.amount,
//       currency: "INR",
//       receipt: `receipt-${Date.now()}`,
//       notes: { userId: userId.toString(), plan },
//     });

//     await Payment.create({
//       userId,
//       plan,
//       credits: selectedPlan.credits,
//       amount: selectedPlan.amount,
//       razorpayOrderId: order.id,
//       currency: "INR",
//       status: "created",
//     });

//     return res.status(200).json({
//       message: "Order created successfully",
//       order: {
//         id: order.id,
//         amount: order.amount,
//         currency: order.currency,
//       },
//       plan: {
//         name: selectedPlan.name,
//         credits: selectedPlan.credits,
//       },
//       key_id: process.env.RAZORPAY_KEY_ID,
//     });
//   } catch (error) {
//     console.error("Razorpay createOrder error:", error);
//     const errorMessage =
//       error?.error?.description || error?.message || JSON.stringify(error);
//     return res
//       .status(error?.statusCode || 500)
//       .json({ message: `create payment error: ${errorMessage}` });
//   }
// };

// export const verify = async (req, res) => {
//   try {
//     const userId = req.user._id;

//     if (!userId) {
//       return res.status(400).json({
//         message: "User ID is required",
//       });
//     }

//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
//       req.body;

//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return res.status(400).json({
//         message: "Payment verification details are required",
//       });
//     }

//     const payment = await Payment.findOne({
//       userId,
//       razorpayOrderId: razorpay_order_id,
//     });

//     if (!payment) {
//       return res.status(404).json({
//         message: "Payment not found",
//       });
//     }

//     if (payment.status === "paid") {
//       return res.status(200).json({
//         message: "Payment already verified",
//       });
//     }

//     const generatedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     const received = Buffer.from(razorpay_signature, "hex");
//     const expected = Buffer.from(generatedSignature, "hex");

//     if (
//       received.length !== expected.length ||
//       !crypto.timingSafeEqual(received, expected)
//     ) {
//       return res.status(400).json({
//         message: "Invalid payment signature",
//       });
//     }

//     payment.status = "paid";
//     payment.razorpayPaymentId = razorpay_payment_id;
//     await payment.save();

//     const user = await User.findByIdAndUpdate(
//       userId,
//       {
//         $inc: {
//           credits: payment.credits,
//         },
//       },
//       {
//         returnDocument: "after",
//       }
//     );

//     if (!user) {
//       throw new Error("User not found");
//     }

//     return res.status(200).json({
//       message: "Payment verified successfully",
//       creditsAdded: payment.credits,
//       credits: user.credits,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       message: "Unable to verify payment",
//     });
//   }
// };


import razorpay from "../config/razorpay.js";
import Payment from "../models/Payment.model.js";
import User from "../models/user.model.js";
import crypto from "crypto";

const Plans = {
  pro: {
    name: "Pro",
    amount: 29900, // ₹299
    credits: 500,
  },
  team: {
    name: "Team",
    amount: 79900, // ₹799
    credits: 2000,
  },
};

const isMockMode = () =>
  !process.env.RAZORPAY_KEY_ID ||
  process.env.RAZORPAY_KEY_ID === "rzp_test_mock";

export const createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const { plan } = req.body;
    const selectedPlan = Plans[plan];
    if (!selectedPlan) {
      return res.status(400).json({ message: "plan not found" });
    }

    // Local simulation when using rzp_test_mock
    if (isMockMode()) {
      const mockOrderId = `order_mock_${Date.now()}`;
      await Payment.create({
        userId,
        plan,
        credits: selectedPlan.credits,
        amount: selectedPlan.amount,
        razorpayOrderId: mockOrderId,
        currency: "INR",
        status: "created",
      });

      return res.status(200).json({
        message: "Mock order created successfully",
        mock: true,
        order: {
          id: mockOrderId,
          amount: selectedPlan.amount,
          currency: "INR",
        },
        plan: {
          name: selectedPlan.name,
          credits: selectedPlan.credits,
        },
        key_id: "rzp_test_mock",
      });
    }

    const order = await razorpay.orders.create({
      amount: selectedPlan.amount,
      currency: "INR",
      receipt: `receipt-${Date.now()}`,
      notes: { userId: userId.toString(), plan },
    });

    await Payment.create({
      userId,
      plan,
      credits: selectedPlan.credits,
      amount: selectedPlan.amount,
      razorpayOrderId: order.id,
      currency: "INR",
      status: "created",
    });

    return res.status(200).json({
      message: "Order created successfully",
      mock: false,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      plan: {
        name: selectedPlan.name,
        credits: selectedPlan.credits,
      },
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay createOrder error:", error);
    const errorMessage =
      error?.error?.description || error?.message || JSON.stringify(error);
    return res
      .status(error?.statusCode || 500)
      .json({ message: `create payment error: ${errorMessage}` });
  }
};

export const verify = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ message: "Payment verification details are required" });
    }

    const payment = await Payment.findOne({
      userId,
      razorpayOrderId: razorpay_order_id,
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status === "paid") {
      return res.status(200).json({ message: "Payment already verified" });
    }

    if (!isMockMode()) {
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      const received = Buffer.from(razorpay_signature, "hex");
      const expected = Buffer.from(generatedSignature, "hex");

      if (
        received.length !== expected.length ||
        !crypto.timingSafeEqual(received, expected)
      ) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }
    }

    payment.status = "paid";
    payment.razorpayPaymentId = razorpay_payment_id;
    await payment.save();

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { credits: payment.credits } },
      { returnDocument: "after" }
    );

    if (!user) {
      throw new Error("User not found");
    }

    return res.status(200).json({
      message: "Payment verified successfully",
      creditsAdded: payment.credits,
      credits: user.credits,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to verify payment" });
  }
};