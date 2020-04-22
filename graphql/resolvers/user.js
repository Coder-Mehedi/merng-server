const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { UserInputError } = require("apollo-server");

const User = require("../../models/User");
const { JWT_SECRET } = require("../../config");
const { registerValidator, loginValidator } = require("../../utils/validators");

const generateToken = (user) => {
	return jwt.sign(
		{
			id: user.id,
			email: user.email,
			username: user.username,
		},
		JWT_SECRET,
		{ expiresIn: "1h" }
	);
};

module.exports = {
	Mutation: {
		async login(_, { username, password }) {
			const { valid, errors } = loginValidator(username, password);
			if (!valid) {
				throw new UserInputError("Errors", { errors });
			}
			const user = await User.findOne({ username });

			if (!user) {
				errors.general = "User not found";
				throw new UserInputError("User not found", { errors });
			}
			const match = await bcrypt.compare(password, user.password);
			if (!match) {
				errors.general = "Wrong Credentials";
				throw new UserInputError("Wrong Credentials", { errors });
			}
			const token = generateToken(user);

			return {
				...user._doc,
				id: user._id,
				token,
			};
		},
		async register(
			_,
			{ registerInput: { username, email, password, confirmPassword } },
			context,
			info
		) {
			// TODO Validate user data
			const { valid, errors } = registerValidator(
				username,
				email,
				password,
				confirmPassword
			);
			if (!valid) {
				throw new UserInputError("Errors", { errors });
			}
			// make sure user doesn't already exits
			const userName = await User.findOne({ username });
			if (userName)
				throw new UserInputError("Username is taken", {
					errors: {
						username: "This username is taken",
					},
				});
			const userEmail = await User.findOne({ email });
			if (userEmail) {
				throw new UserInputError("Account With this email already exits", {
					errors: {
						email: "This Email Already Registered",
					},
				});
			}
			// hash the password and create an auth token
			password = await bcrypt.hash(password, 12);
			const newUser = new User({
				email,
				username,
				password,
				createdAt: new Date().toISOString(),
			});

			const res = await newUser.save();
			const token = generateToken(res);
			return {
				...res._doc,
				id: res._id,
				token,
			};
		},
	},
};
