import User from "../models/users.js";
import bcrypt from "bcrypt";

export function createUser(req, res) {

    const data = req.body;
    const hashedPassword = bcrypt.hashSync(data.password, 10);
    
    const user = new User(
        {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            password: hashedPassword,
            role: data.role
        }
    );
    user.save().then(
        ()=>{
            res.json({
                message: "User created successfully",
            })
        }
    )
        
}


export function loginUsers(req, res) {
    const email = req.body.email;
    const password = req.body.password;

    User.find({email: email}).then(
        (users) => {
            if(users[0] == null){
                res.json({
                    message: "User not found"
                })
            } else {
                const user = users[0]
                
                const isPasswordCorrect = bcrypt.compareSync(password, user.password)
                if(isPasswordCorrect){
                    res.json({
                        message: "Login successful",
                        
                    })
                } else {
                    res.json({
                        message: "Incorrect password"
                    })
                }
            }
        }
    )


}