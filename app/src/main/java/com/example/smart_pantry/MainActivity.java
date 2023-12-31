package com.example.smart_pantry;

import androidx.annotation.NonNull;
import androidx.appcompat.app.ActionBarDrawerToggle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.drawerlayout.widget.DrawerLayout;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.MenuItem;
import android.view.View;
import android.widget.Button;

import com.amplifyframework.api.rest.RestOptions;
import com.amplifyframework.auth.cognito.result.AWSCognitoAuthSignOutResult;
import com.amplifyframework.auth.cognito.result.GlobalSignOutError;
import com.amplifyframework.auth.cognito.result.HostedUIError;
import com.amplifyframework.auth.cognito.result.RevokeTokenError;
import com.example.smart_pantry.Adapter.CardAdapter;
import com.example.smart_pantry.model.Card;
import com.example.smart_pantry.model.Recipe;
import com.example.smart_pantry.model.UserDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.android.material.navigation.NavigationView;

import com.amplifyframework.core.Amplify;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;


public class MainActivity extends AppCompatActivity {

    public DrawerLayout drawerLayout;
    public ActionBarDrawerToggle actionBarDrawerToggle;

    Button exploreAllbutton;

    @SuppressLint("MissingInflatedId")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        exploreAllbutton = findViewById(R.id.exploreAllButton);


        drawerLayout = findViewById(R.id.drawer_layout);
        actionBarDrawerToggle = new ActionBarDrawerToggle(this, drawerLayout, R.string.nav_open, R.string.nav_close);

        drawerLayout.addDrawerListener(actionBarDrawerToggle);
        actionBarDrawerToggle.syncState();

        getSupportActionBar().setDisplayHomeAsUpEnabled(true);

        NavigationView navigationView = findViewById(R.id.sidebar);
        navigationView.setNavigationItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_home) {
                startActivity(new Intent(MainActivity.this, MainActivity.class));
            } else if (id == R.id.nav_profile) {
                startActivity(new Intent(MainActivity.this, Profile.class));
            } else if (id == R.id.nav_pantry) {
                startActivity(new Intent(MainActivity.this, MyPantry.class));
            } else if (id == R.id.nav_recipes) {
                startActivity(new Intent(MainActivity.this, RecommendedRecipes.class));
            } else if (id == R.id.nav_logout) {
                logout();
            }
            drawerLayout.closeDrawers();
            return true;
        });
        List<Card> cardItems = new ArrayList<>();
        RestOptions options = RestOptions.builder()
                .addPath("/genrecipes").build();
        final Recipe[][] recipe = new Recipe[1][1];

        Amplify.API.get("fetchRecipes", options,
                response -> {
                    runOnUiThread(() -> {
                        Log.i("MyAmplifyApp", "GET succeeded: " + response);
                        ObjectMapper objectMapper = new ObjectMapper();
                        try {
                            recipe[0] = objectMapper.readValue(response.getData().asString(), Recipe[].class);
                            if (recipe[0].length < 4) {
                                for (Recipe r : recipe[0]) {
                                    cardItems.add(new Card(r.getImageURL(), r.getRecipeName(),r));
                                }
                            } else {
                                for (int i = 0; i < 4; i++) {
                                    cardItems.add(new Card(recipe[0][i].getImageURL(), recipe[0][i].getRecipeName(),recipe[0][i]));
                                }
                            }

                            RecyclerView recyclerView = findViewById(R.id.recipesRecyclerView);
                            CardAdapter cardAdapter = new CardAdapter(this, cardItems);
                            recyclerView.setAdapter(cardAdapter);

                            // Set the layout manager
                            LinearLayoutManager layoutManager = new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false);
                            recyclerView.setLayoutManager(layoutManager);
                        } catch (IOException e) {
                            throw new RuntimeException(e);
                        }
                    });
                },
                apiFailure -> {
                    runOnUiThread(() -> {
                        Log.i("MyAmplifyApp", "GET failed: " + apiFailure);
                    });
                });


        exploreAllbutton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent intent = new Intent(getApplicationContext(), ExploreAll.class);
                intent.putExtra("recipes", recipe[0]);
                startActivity(intent);
            }
        });

    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {

        if (actionBarDrawerToggle.onOptionsItemSelected(item)) {
            return true;
        }
        return super.onOptionsItemSelected(item);
    }


    private void logout() {
        Amplify.Auth.signOut(
                signOutResult -> {
                    if (signOutResult instanceof AWSCognitoAuthSignOutResult.CompleteSignOut) {
                // Sign Out completed fully and without errors.
                        startActivity(new Intent(MainActivity.this, SplashScreen.class));
                        Log.i("AuthQuickStart", "Signed out successfully");
            } else if (signOutResult instanceof AWSCognitoAuthSignOutResult.PartialSignOut) {
                // Sign Out completed with some errors. User is signed out of the device.
                AWSCognitoAuthSignOutResult.PartialSignOut partialSignOutResult =
                        (AWSCognitoAuthSignOutResult.PartialSignOut) signOutResult;

                HostedUIError hostedUIError = partialSignOutResult.getHostedUIError();
                if (hostedUIError != null) {
                    Log.e("AuthQuickStart", "HostedUI Error", hostedUIError.getException());
                    // Optional: Re-launch hostedUIError.getUrl() in a Custom tab to clear Cognito web session.
                }

                GlobalSignOutError globalSignOutError = partialSignOutResult.getGlobalSignOutError();
                if (globalSignOutError != null) {
                    Log.e("AuthQuickStart", "GlobalSignOut Error", globalSignOutError.getException());
                    // Optional: Use escape hatch to retry revocation of globalSignOutError.getAccessToken().
                }

                RevokeTokenError revokeTokenError = partialSignOutResult.getRevokeTokenError();
                if (revokeTokenError != null) {
                    Log.e("AuthQuickStart", "RevokeToken Error", revokeTokenError.getException());
                    // Optional: Use escape hatch to retry revocation of revokeTokenError.getRefreshToken().
                }
            } else if (signOutResult instanceof AWSCognitoAuthSignOutResult.FailedSignOut) {
                AWSCognitoAuthSignOutResult.FailedSignOut failedSignOutResult =
                        (AWSCognitoAuthSignOutResult.FailedSignOut) signOutResult;
                // Sign Out failed with an exception, leaving the user signed in.
                Log.e("AuthQuickStart", "Sign out Failed", failedSignOutResult.getException());
            }
        });
    }


}