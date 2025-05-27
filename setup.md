
 docker exec -it optihazmat_app npx prisma generate
 docker exec -it optihazmat_app npx prisma migrate dev
 docker exec -it optihazmat_app npx prisma db seed
 docker exec -it optihazmat_app npx prisma migrate deploy
